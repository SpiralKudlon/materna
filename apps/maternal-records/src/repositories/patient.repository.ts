/**
 * patient.repository.ts
 *
 * Data access for the patients table.
 * Every query enforces tenant isolation via SET LOCAL and
 * checks that the requesting user is assigned to the patient.
 */
import type { Pool, PoolClient } from 'pg';
import { CryptoService } from '../services/crypto.service.js';
import { KmsService } from '../services/kms.service.js';

export interface PatientRow {
    id: string;
    tenant_id: string;
    kms_key_id: string;
    full_name_enc: Buffer;
    phone_enc: Buffer;
    date_of_birth: Buffer | null;
    sex: string | null;
    national_id: string | null;
    registered_by: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface PatientDTO {
    id: string;
    tenant_id: string;
    full_name: string;
    phone: string;
    date_of_birth: string | null;
    sex: string | null;
    national_id: string | null;
    registered_by: string | null;
    created_at: string;
    updated_at: string;
}

// ── Encryption helpers (AES-256-GCM) ──────────────────────────────────
// Now using KMS Data Encryption Keys (DEK) and CryptoService.

async function rowToDto(row: PatientRow): Promise<PatientDTO> {
    const dek = await KmsService.decryptDataKey(row.kms_key_id);

    return {
        id: row.id,
        tenant_id: row.tenant_id,
        full_name: CryptoService.decryptField(row.full_name_enc, dek),
        phone: CryptoService.decryptField(row.phone_enc, dek),
        date_of_birth: row.date_of_birth ? CryptoService.decryptField(row.date_of_birth, dek) : null,
        sex: row.sex,
        national_id: row.national_id,
        registered_by: row.registered_by,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
    };
}

// ── Repository ─────────────────────────────────────────────────────────

export class PatientRepository {
    constructor(private pool: Pool) { }

    /** Set tenant context on a client for RLS. */
    private async setTenant(client: PoolClient, tenantId: string): Promise<void> {
        await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);
    }

    /**
     * Verify that the requesting user is assigned to this patient.
     * CHVs can only access patients they registered.
     * Throws if not authorised.
     */
    private async assertAssignment(
        client: PoolClient,
        patientId: string,
        userId: string,
    ): Promise<void> {
        const { rows } = await client.query(
            `SELECT 1 FROM patients WHERE id = $1 AND registered_by = $2`,
            [patientId, userId],
        );
        if (rows.length === 0) {
            const err = new Error('Forbidden: you are not assigned to this patient');
            (err as NodeJS.ErrnoException).code = 'FORBIDDEN';
            throw err;
        }
    }

    async create(
        tenantId: string,
        userId: string,
        data: { full_name: string; phone: string; date_of_birth?: string; sex?: string; national_id?: string },
    ): Promise<PatientDTO> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await this.setTenant(client, tenantId);

            const { plaintextDek, kmsKeyId } = await KmsService.generateDataKey();

            const { rows } = await client.query<PatientRow>(
                `INSERT INTO patients (tenant_id, kms_key_id, full_name_enc, phone_enc, date_of_birth, sex, national_id, registered_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING *`,
                [
                    tenantId,
                    kmsKeyId,
                    CryptoService.encryptField(data.full_name, plaintextDek),
                    CryptoService.encryptField(data.phone, plaintextDek),
                    data.date_of_birth ? CryptoService.encryptField(data.date_of_birth, plaintextDek) : null,
                    data.sex ?? null,
                    data.national_id ?? null,
                    userId,
                ],
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

    async findById(tenantId: string, userId: string, patientId: string): Promise<PatientDTO | null> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await this.setTenant(client, tenantId);
            await this.assertAssignment(client, patientId, userId);

            const { rows } = await client.query<PatientRow>(
                `SELECT * FROM patients WHERE id = $1`, [patientId],
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

    async listByTenant(tenantId: string, limit = 50, offset = 0): Promise<PatientDTO[]> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await this.setTenant(client, tenantId);

            const { rows } = await client.query<PatientRow>(
                `SELECT * FROM patients ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
                [limit, offset],
            );
            await client.query('COMMIT');
            return Promise.all(rows.map(rowToDto));
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async update(
        tenantId: string,
        userId: string,
        patientId: string,
        data: { full_name?: string; phone?: string; date_of_birth?: string; sex?: string; national_id?: string },
    ): Promise<PatientDTO> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await this.setTenant(client, tenantId);
            await this.assertAssignment(client, patientId, userId);

            // Fetch existing KMS Key ID to reuse it for the update DEK
            const exRows = await client.query<{ kms_key_id: string }>(
                `SELECT kms_key_id FROM patients WHERE id = $1`, [patientId]
            );
            const kmsKeyId = exRows.rows[0].kms_key_id;
            const dek = await KmsService.decryptDataKey(kmsKeyId);

            const sets: string[] = [];
            const vals: unknown[] = [];
            let idx = 1;

            if (data.full_name !== undefined) { sets.push(`full_name_enc = $${idx++}`); vals.push(CryptoService.encryptField(data.full_name, dek)); }
            if (data.phone !== undefined) { sets.push(`phone_enc = $${idx++}`); vals.push(CryptoService.encryptField(data.phone, dek)); }
            if (data.date_of_birth !== undefined) { sets.push(`date_of_birth = $${idx++}`); vals.push(CryptoService.encryptField(data.date_of_birth, dek)); }
            if (data.sex !== undefined) { sets.push(`sex = $${idx++}`); vals.push(data.sex); }
            if (data.national_id !== undefined) { sets.push(`national_id = $${idx++}`); vals.push(data.national_id); }

            if (sets.length === 0) {
                await client.query('ROLLBACK');
                throw new Error('No fields to update');
            }

            vals.push(patientId);
            const { rows } = await client.query<PatientRow>(
                `UPDATE patients SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
                vals,
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

    async delete(tenantId: string, userId: string, patientId: string): Promise<boolean> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await this.setTenant(client, tenantId);
            await this.assertAssignment(client, patientId, userId);

            const { rowCount } = await client.query(
                `DELETE FROM patients WHERE id = $1`, [patientId],
            );
            await client.query('COMMIT');
            return (rowCount ?? 0) > 0;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}
