/**
 * tests/integration/encryption.test.ts
 *
 * Integration-level verification of the field-level encryption pipeline:
 *   INSERT path  → full_name, phone, date_of_birth are stored as opaque Buffers
 *   SELECT path  → repository transparently decrypts using the stored KMS key ID
 *
 * KmsService and CryptoService are NOT mocked here — we use the real
 * implementations (in test-mode fallback) to prove the full encrypt/decrypt
 * round-trip works end-to-end.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Pool } from 'pg';
import { PatientRepository, type PatientRow } from '../../src/repositories/patient.repository.js';
import { CryptoService } from '../../src/services/crypto.service.js';
import { KmsService } from '../../src/services/kms.service.js';

// NODE_ENV=test is already set by vitest, so KmsService uses its in-memory
// fallback — no AWS credentials required.

const TENANT = '00000000-0000-0000-0000-000000000001';
const USER = 'user-integration-1';

describe('Field-Level Encryption — Integration (AWS KMS + pgcrypto)', () => {

    let pool: Pool;
    let repo: PatientRepository;
    let mockClient: { query: (text: string, values?: any[]) => Promise<{ rows: any[] }>; release: () => void };

    beforeEach(() => {
        // Reset the KMS test-mode store so key IDs don't bleed between tests.
        KmsService._testReset();

        mockClient = {
            query: async (text: string, _values?: any[]) => {
                if (
                    text === 'BEGIN' ||
                    text === 'COMMIT' ||
                    text === 'ROLLBACK' ||
                    text.startsWith('SET LOCAL')
                ) {
                    return { rows: [] };
                }
                return { rows: [] };
            },
            release: () => { },
        };

        pool = {
            connect: () => Promise.resolve(mockClient),
        } as unknown as Pool;

        repo = new PatientRepository(pool);
    });

    afterEach(() => {
        KmsService._testReset();
    });

    // ────────────────────────────────────────────────────────────────────
    // INSERT path
    // ────────────────────────────────────────────────────────────────────

    it('stores full_name, phone, and date_of_birth as opaque Buffers on INSERT — NOT plaintext', async () => {
        let capturedDbRow: PatientRow | null = null;

        mockClient.query = async (text: string, values?: any[]) => {
            if (
                text === 'BEGIN' ||
                text === 'COMMIT' ||
                text.startsWith('SET LOCAL')
            ) return { rows: [] };

            if (text.includes('INSERT INTO patients')) {
                expect(values).toBeDefined();
                expect(values!.length).toBe(8);

                const [tenantId, kmsKeyId, fullNameEnc, phoneEnc, dobEnc] = values!;

                // ── KMS key ID is a synthetic test key (not empty) ──────
                expect(typeof kmsKeyId).toBe('string');
                expect(kmsKeyId.length).toBeGreaterThan(0);

                // ── All PII fields stored as Buffers, never as strings ──
                expect(Buffer.isBuffer(fullNameEnc)).toBe(true);
                expect(Buffer.isBuffer(phoneEnc)).toBe(true);
                expect(Buffer.isBuffer(dobEnc)).toBe(true);

                // ── Plaintext must NOT appear anywhere in the ciphertext ─
                const fullNameHex = (fullNameEnc as Buffer).toString('hex');
                const phoneHex = (phoneEnc as Buffer).toString('hex');
                const dobHex = (dobEnc as Buffer).toString('hex');

                const janeHex = Buffer.from('Jane Doe').toString('hex');
                const telHex = Buffer.from('+254700000000').toString('hex');
                const dobPlainHex = Buffer.from('1990-01-01').toString('hex');

                expect(fullNameHex).not.toContain(janeHex);
                expect(phoneHex).not.toContain(telHex);
                expect(dobHex).not.toContain(dobPlainHex);

                // Build a realistic simulated DB row using the actual ciphertext
                capturedDbRow = {
                    id: 'patient-integ-001',
                    tenant_id: tenantId,
                    kms_key_id: kmsKeyId,
                    full_name_enc: fullNameEnc,
                    phone_enc: phoneEnc,
                    date_of_birth: dobEnc,
                    sex: 'F',
                    national_id: null,
                    registered_by: USER,
                    created_at: new Date(),
                    updated_at: new Date(),
                };
                return { rows: [capturedDbRow] };
            }

            return { rows: [] };
        };

        const dto = await repo.create(TENANT, USER, {
            full_name: 'Jane Doe',
            phone: '+254700000000',
            date_of_birth: '1990-01-01',
            sex: 'F',
        });

        // Application layer transparently decrypts for callers
        expect(dto.full_name).toBe('Jane Doe');
        expect(dto.phone).toBe('+254700000000');
        expect(dto.date_of_birth).toBe('1990-01-01');

        // Raw DB row must be defined and contain BYTEA buffers + KMS key ID
        expect(capturedDbRow).not.toBeNull();
        expect(capturedDbRow!.kms_key_id.startsWith('test-key-')).toBe(true);
        expect(Buffer.isBuffer(capturedDbRow!.full_name_enc)).toBe(true);
        expect(Buffer.isBuffer(capturedDbRow!.phone_enc)).toBe(true);
        expect(Buffer.isBuffer(capturedDbRow!.date_of_birth)).toBe(true);
    });

    // ────────────────────────────────────────────────────────────────────
    // SELECT path
    // ────────────────────────────────────────────────────────────────────

    it('transparently decrypts all PII fields on SELECT using the stored KMS key ID', async () => {
        // 1. Generate a real DEK via the test-mode KMS path
        const { plaintextDek, kmsKeyId } = await KmsService.generateDataKey();

        // 2. Produce actual AES-256-CBC ciphertext (IV-prepended)
        const rawDbRow: PatientRow = {
            id: 'patient-integ-002',
            tenant_id: TENANT,
            kms_key_id: kmsKeyId,
            full_name_enc: CryptoService.encryptField('Wanjiku Kamau', plaintextDek),
            phone_enc: CryptoService.encryptField('+254711999888', plaintextDek),
            date_of_birth: CryptoService.encryptField('1988-03-22', plaintextDek),
            sex: 'F',
            national_id: null,
            registered_by: USER,
            created_at: new Date(),
            updated_at: new Date(),
        };

        // Sanity: raw fields must NOT expose plaintext bytes
        expect(rawDbRow.full_name_enc.toString('hex')).not.toContain(
            Buffer.from('Wanjiku Kamau').toString('hex')
        );

        // 3. Mock the DB to return this pre-encrypted row
        mockClient.query = async (text: string) => {
            if (
                text === 'BEGIN' ||
                text === 'COMMIT' ||
                text.startsWith('SET LOCAL')
            ) return { rows: [] };

            if (text.includes('SELECT 1 FROM patients')) {
                return { rows: [{ '?column?': 1 }] }; // assignment check passes
            }
            if (text.includes('SELECT * FROM patients WHERE id')) {
                return { rows: [rawDbRow] };
            }
            return { rows: [] };
        };

        // 4. Fetch via repository
        const result = await repo.findById(TENANT, USER, 'patient-integ-002');

        // 5. Application layer must surface fully decrypted plaintext
        expect(result).not.toBeNull();
        expect(result!.full_name).toBe('Wanjiku Kamau');
        expect(result!.phone).toBe('+254711999888');
        expect(result!.date_of_birth).toBe('1988-03-22');

        // Encrypted fields must NOT leak into the DTO
        expect(result).not.toHaveProperty('full_name_enc');
        expect(result).not.toHaveProperty('phone_enc');
        expect(result).not.toHaveProperty('kms_key_id');
    });
});
