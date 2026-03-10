import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Pool } from 'pg';
import { PatientRepository, PatientRow } from '../../src/repositories/patient.repository.js';
import { CryptoService } from '../../src/services/crypto.service.js';
import { KmsService } from '../../src/services/kms.service.js';

describe('Field-Level Encryption (AWS KMS + pgcrypto)', () => {
    let pool: Pool;
    let repo: PatientRepository;
    let mockClient: any;

    beforeEach(() => {
        mockClient = {
            query: vi.fn(),
            release: vi.fn(),
        };

        pool = {
            connect: vi.fn().mockResolvedValue(mockClient)
        } as unknown as Pool;

        repo = new PatientRepository(pool);

        // Clear mock keys state between tests
        (KmsService as any).mockMasterKeys.clear();
    });

    it('should transparently encrypt full_name, phone, and date_of_birth on INSERT and store kms_key_id', async () => {
        const tenantId = '00000000-0000-0000-0000-000000000001';
        const userId = 'user-1';

        // 1. Intercept the INSERT query to capture the raw DB payload
        let capturedDbRow: PatientRow | null = null;

        mockClient.query.mockImplementation(async (text: string, values: any[]) => {
            if (text === 'BEGIN' || text.startsWith('SET LOCAL') || text === 'COMMIT') {
                return { rows: [] };
            }

            if (text.includes('INSERT INTO patients')) {
                // Assert params length matches our SQL statement (8 params)
                expect(values.length).toBe(8);

                const [t_id, kms_key_id, full_name_enc, phone_enc, dob_enc, sex, national_id, reg_by] = values;

                // Prove the plaintext is nowhere in the query payload
                expect(full_name_enc.toString('utf-8')).not.toContain('Jane Doe');
                expect(phone_enc.toString('utf-8')).not.toContain('+254700000000');
                expect(dob_enc.toString('utf-8')).not.toContain('1990-01-01');

                // Simulate DB returning the inserted row (mimicking RETURNING *)
                capturedDbRow = {
                    id: 'patient-123',
                    tenant_id: t_id,
                    kms_key_id: kms_key_id,
                    full_name_enc: full_name_enc,
                    phone_enc: phone_enc,
                    date_of_birth: dob_enc,
                    sex: sex,
                    national_id: national_id,
                    registered_by: reg_by,
                    created_at: new Date(),
                    updated_at: new Date()
                };

                return { rows: [capturedDbRow] };
            }
            return { rows: [] };
        });

        // 2. Perform the creation via the Repository
        const result = await repo.create(tenantId, userId, {
            full_name: 'Jane Doe',
            phone: '+254700000000',
            date_of_birth: '1990-01-01',
            sex: 'F'
        });

        // 3. Assert the DTO returned to the HTTP layer is perfectly decrypted
        expect(result.full_name).toBe('Jane Doe');
        expect(result.phone).toBe('+254700000000');
        expect(result.date_of_birth).toBe('1990-01-01');

        // 4. Assert the raw DB row actually stored ciphertext buffers and a KMS ID
        expect(capturedDbRow).toBeDefined();
        expect(capturedDbRow!.kms_key_id).toContain('arn:aws:kms:eu-west-1:');
        expect(Buffer.isBuffer(capturedDbRow!.full_name_enc)).toBe(true);
        expect(Buffer.isBuffer(capturedDbRow!.phone_enc)).toBe(true);
        expect(Buffer.isBuffer(capturedDbRow!.date_of_birth)).toBe(true);
    });

    it('should transparently decrypt rows on SELECT using the stored KMS Key ID', async () => {
        const tenantId = '00000000-0000-0000-0000-000000000001';
        const userId = 'user-1';
        const patientId = 'patient-123';

        // 1. Setup a fake encrypted row using the Crypto/KMS services directly
        const { plaintextDek, kmsKeyId } = await KmsService.generateDataKey();

        const rawDbRow: PatientRow = {
            id: patientId,
            tenant_id: tenantId,
            kms_key_id: kmsKeyId,
            full_name_enc: CryptoService.encryptField('Decrypted Name', plaintextDek),
            phone_enc: CryptoService.encryptField('123456789', plaintextDek),
            date_of_birth: CryptoService.encryptField('1995-12-31', plaintextDek),
            sex: 'M',
            national_id: null,
            registered_by: userId,
            created_at: new Date(),
            updated_at: new Date()
        };

        // 2. Mock PG driver to return the simulated raw encrypted row
        mockClient.query.mockImplementation(async (text: string, values: any[]) => {
            if (text === 'BEGIN' || text.startsWith('SET LOCAL') || text === 'COMMIT') {
                return { rows: [] };
            }
            if (text.includes('SELECT 1 FROM patients')) {
                // RLS assignment check
                return { rows: [{ '?column?': 1 }] };
            }
            if (text.includes('SELECT * FROM patients WHERE id = $1')) {
                return { rows: [rawDbRow] };
            }
            return { rows: [] };
        });

        // 3. Fetch via repository
        const result = await repo.findById(tenantId, userId, patientId);

        // 4. Assert the app-layer outputs perfectly decrypted plaintext
        expect(result).not.toBeNull();
        expect(result!.full_name).toBe('Decrypted Name');
        expect(result!.phone).toBe('123456789');
        expect(result!.date_of_birth).toBe('1995-12-31');
    });
});
