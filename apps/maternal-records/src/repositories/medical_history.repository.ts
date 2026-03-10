/**
 * medical_history.repository.ts
 *
 * Data access for the medical_history table.
 * Demonstrates KMS field-level encryption for the `hiv_status` field.
 */
import type { Pool, PoolClient } from 'pg';
import { CryptoService } from '../services/crypto.service.js';
import { KmsService } from '../services/kms.service.js';

export interface MedicalHistoryRow {
    id: string;
    patient_id: string;
    tenant_id: string;
    kms_key_id: string;
    blood_type: string | null;
    allergies: any | null; // JSONB
    chronic_conditions: any | null; // JSONB
    hiv_status: Buffer | null;
    past_pregnancies: number;
    notes: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface MedicalHistoryDTO {
    id: string;
    patient_id: string;
    tenant_id: string;
    blood_type: string | null;
    allergies: any | null;
    chronic_conditions: any | null;
    hiv_status: string | null;
    past_pregnancies: number;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

async function rowToDto(row: MedicalHistoryRow): Promise<MedicalHistoryDTO> {
    let decryptedHivStatus: string | null = null;

    if (row.hiv_status && row.kms_key_id) {
        const dek = await KmsService.decryptDataKey(row.kms_key_id);
        decryptedHivStatus = CryptoService.decryptField(row.hiv_status, dek);
    }

    return {
        id: row.id,
        patient_id: row.patient_id,
        tenant_id: row.tenant_id,
        blood_type: row.blood_type,
        allergies: row.allergies,
        chronic_conditions: row.chronic_conditions,
        hiv_status: decryptedHivStatus,
        past_pregnancies: row.past_pregnancies,
        notes: row.notes,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
    };
}

export class MedicalHistoryRepository {
    constructor(private pool: Pool) { }

    private async setTenant(client: PoolClient, tenantId: string): Promise<void> {
        await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);
    }

    async create(
        tenantId: string,
        patientId: string,
        data: {
            blood_type?: string;
            allergies?: any;
            chronic_conditions?: any;
            hiv_status?: string;
            past_pregnancies?: number;
            notes?: string;
        }
    ): Promise<MedicalHistoryDTO> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await this.setTenant(client, tenantId);

            const { plaintextDek, kmsKeyId } = await KmsService.generateDataKey();

            const { rows } = await client.query<MedicalHistoryRow>(
                `INSERT INTO medical_history (
                    tenant_id, patient_id, kms_key_id, blood_type, allergies,
                    chronic_conditions, hiv_status, past_pregnancies, notes
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [
                    tenantId,
                    patientId,
                    kmsKeyId,
                    data.blood_type ?? null,
                    data.allergies ? JSON.stringify(data.allergies) : null,
                    data.chronic_conditions ? JSON.stringify(data.chronic_conditions) : null,
                    data.hiv_status ? CryptoService.encryptField(data.hiv_status, plaintextDek) : null,
                    data.past_pregnancies ?? 0,
                    data.notes ?? null,
                ]
            );
            await client.query('COMMIT');
            return await rowToDto(rows[0]);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async findByPatient(tenantId: string, patientId: string): Promise<MedicalHistoryDTO | null> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await this.setTenant(client, tenantId);

            const { rows } = await client.query<MedicalHistoryRow>(
                `SELECT * FROM medical_history WHERE patient_id = $1 LIMIT 1`,
                [patientId]
            );
            await client.query('COMMIT');
            return rows.length > 0 ? await rowToDto(rows[0]) : null;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}
