/**
 * visit.repository.ts
 *
 * Data access for the anc_visits table.
 * The DB trigger auto-computes next_visit_date and visit_number.
 */
import type { Pool, PoolClient } from 'pg';

export interface AncVisitRow {
    id: string;
    patient_id: string;
    tenant_id: string;
    visit_number: number;
    visit_date: string;
    status: string;
    provider_id: string | null;
    bp_systolic: number | null;
    bp_diastolic: number | null;
    weight_kg: number | null;
    height_cm: number | null;
    fundal_height_cm: number | null;
    fetal_heart_rate: number | null;
    gestational_age_weeks: number;
    next_visit_date: string | null;
    notes: string | null;
    is_high_risk: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface AncVisitDTO {
    id: string;
    patient_id: string;
    visit_number: number;
    visit_date: string;
    status: string;
    bp_systolic: number | null;
    bp_diastolic: number | null;
    weight_kg: number | null;
    height_cm: number | null;
    fundal_height_cm: number | null;
    fetal_heart_rate: number | null;
    gestational_age_weeks: number;
    next_visit_date: string | null;
    notes: string | null;
    is_high_risk: boolean;
    created_at: string;
}

function rowToDto(row: AncVisitRow): AncVisitDTO {
    return {
        id: row.id,
        patient_id: row.patient_id,
        visit_number: row.visit_number,
        visit_date: row.visit_date,
        status: row.status,
        bp_systolic: row.bp_systolic,
        bp_diastolic: row.bp_diastolic,
        weight_kg: row.weight_kg ? Number(row.weight_kg) : null,
        height_cm: row.height_cm ? Number(row.height_cm) : null,
        fundal_height_cm: row.fundal_height_cm ? Number(row.fundal_height_cm) : null,
        fetal_heart_rate: row.fetal_heart_rate,
        gestational_age_weeks: row.gestational_age_weeks,
        next_visit_date: row.next_visit_date,
        notes: row.notes,
        is_high_risk: row.is_high_risk,
        created_at: row.created_at.toISOString(),
    };
}

export class VisitRepository {
    constructor(private pool: Pool) { }

    private async setTenant(client: PoolClient, tenantId: string): Promise<void> {
        await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);
    }

    async create(
        tenantId: string,
        patientId: string,
        providerId: string | null,
        data: {
            visit_date?: string;
            bp_systolic?: number;
            bp_diastolic?: number;
            weight_kg?: number;
            height_cm?: number;
            fundal_height_cm?: number;
            fetal_heart_rate?: number;
            gestational_age_weeks: number;
            notes?: string;
        },
    ): Promise<AncVisitDTO> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await this.setTenant(client, tenantId);

            // visit_number = 0 signals the trigger to auto-compute
            const { rows } = await client.query<AncVisitRow>(
                `INSERT INTO anc_visits (
                    patient_id, tenant_id, visit_number, visit_date, provider_id,
                    bp_systolic, bp_diastolic, weight_kg, height_cm,
                    fundal_height_cm, fetal_heart_rate,
                    gestational_age_weeks, notes, status
                ) VALUES (
                    $1, $2, 0, COALESCE($3, CURRENT_DATE), $4,
                    $5, $6, $7, $8, $9, $10, $11, $12, 'COMPLETED'
                ) RETURNING *`,
                [
                    patientId,
                    tenantId,
                    data.visit_date ?? null,
                    providerId,
                    data.bp_systolic ?? null,
                    data.bp_diastolic ?? null,
                    data.weight_kg ?? null,
                    data.height_cm ?? null,
                    data.fundal_height_cm ?? null,
                    data.fetal_heart_rate ?? null,
                    data.gestational_age_weeks,
                    data.notes ?? null,
                ],
            );

            await client.query('COMMIT');
            return rowToDto(rows[0]);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async listByPatient(tenantId: string, patientId: string): Promise<AncVisitDTO[]> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await this.setTenant(client, tenantId);

            const { rows } = await client.query<AncVisitRow>(
                `SELECT * FROM anc_visits WHERE patient_id = $1 ORDER BY visit_number DESC`,
                [patientId],
            );
            await client.query('COMMIT');
            return rows.map(rowToDto);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}
