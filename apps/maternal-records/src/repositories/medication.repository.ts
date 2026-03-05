/**
 * medication.repository.ts
 *
 * Data access for medication adherence logs.
 * NOTE: This uses a medication_logs table that should be added
 * via a migration. We create it inline if it doesn't exist
 * for development flexibility.
 */
import type { Pool, PoolClient } from 'pg';

export interface MedicationLogRow {
    id: string;
    patient_id: string;
    tenant_id: string;
    medication_name: string;
    action: 'TAKEN' | 'SKIPPED';
    scheduled_at: Date | null;
    notes: string | null;
    created_at: Date;
}

export interface MedicationLogDTO {
    id: string;
    patient_id: string;
    medication_name: string;
    action: 'TAKEN' | 'SKIPPED';
    scheduled_at: string | null;
    notes: string | null;
    created_at: string;
}

export interface AdherenceStats {
    medication_name: string;
    total_logs_7d: number;
    taken_count: number;
    skipped_count: number;
    adherence_rate_7d: number; // 0.0 – 1.0
}

function rowToDto(row: MedicationLogRow): MedicationLogDTO {
    return {
        id: row.id,
        patient_id: row.patient_id,
        medication_name: row.medication_name,
        action: row.action,
        scheduled_at: row.scheduled_at?.toISOString() ?? null,
        notes: row.notes,
        created_at: row.created_at.toISOString(),
    };
}

export class MedicationRepository {
    constructor(private pool: Pool) { }

    private async setTenant(client: PoolClient, tenantId: string): Promise<void> {
        await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);
    }

    /**
     * Ensure the medication_logs table exists.
     * Called once at app startup.
     */
    async ensureTable(): Promise<void> {
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS medication_logs (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
                tenant_id       UUID NOT NULL REFERENCES tenants(id)  ON DELETE RESTRICT,
                medication_name TEXT NOT NULL,
                action          TEXT NOT NULL CHECK (action IN ('TAKEN', 'SKIPPED')),
                scheduled_at    TIMESTAMPTZ,
                notes           TEXT,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
            );

            CREATE INDEX IF NOT EXISTS idx_medlog_patient ON medication_logs (patient_id);
            CREATE INDEX IF NOT EXISTS idx_medlog_tenant  ON medication_logs (tenant_id);
            CREATE INDEX IF NOT EXISTS idx_medlog_created ON medication_logs (created_at DESC);
        `);
    }

    async log(
        tenantId: string,
        patientId: string,
        data: {
            medication_name: string;
            action: 'TAKEN' | 'SKIPPED';
            scheduled_at?: string;
            notes?: string;
        },
    ): Promise<{ entry: MedicationLogDTO; adherence: AdherenceStats }> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await this.setTenant(client, tenantId);

            // 1. Insert the log entry
            const { rows: insertRows } = await client.query<MedicationLogRow>(
                `INSERT INTO medication_logs (patient_id, tenant_id, medication_name, action, scheduled_at, notes)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [
                    patientId,
                    tenantId,
                    data.medication_name,
                    data.action,
                    data.scheduled_at ?? null,
                    data.notes ?? null,
                ],
            );

            // 2. Compute 7-day adherence for this medication
            const { rows: statsRows } = await client.query<{
                total: string;
                taken: string;
                skipped: string;
            }>(
                `SELECT
                    COUNT(*)                                          AS total,
                    COUNT(*) FILTER (WHERE action = 'TAKEN')          AS taken,
                    COUNT(*) FILTER (WHERE action = 'SKIPPED')        AS skipped
                 FROM medication_logs
                 WHERE patient_id = $1
                   AND medication_name = $2
                   AND created_at >= now() - INTERVAL '7 days'`,
                [patientId, data.medication_name],
            );

            await client.query('COMMIT');

            const total = parseInt(statsRows[0].total, 10);
            const taken = parseInt(statsRows[0].taken, 10);
            const skipped = parseInt(statsRows[0].skipped, 10);

            return {
                entry: rowToDto(insertRows[0]),
                adherence: {
                    medication_name: data.medication_name,
                    total_logs_7d: total,
                    taken_count: taken,
                    skipped_count: skipped,
                    adherence_rate_7d: total > 0 ? Math.round((taken / total) * 100) / 100 : 0,
                },
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}
