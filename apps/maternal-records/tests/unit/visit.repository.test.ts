/**
 * Unit tests for VisitRepository.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool, QueryResult } from 'pg';
import { VisitRepository, type AncVisitRow } from '../../src/repositories/visit.repository.js';

const TENANT = 't-001';
const PATIENT = 'p-001';
const PROVIDER = 'u-001';
const NOW = new Date('2026-03-01');

function makeVisitRow(overrides: Partial<AncVisitRow> = {}): AncVisitRow {
    return {
        id: 'v-001',
        patient_id: PATIENT,
        tenant_id: TENANT,
        visit_number: 1,
        visit_date: '2026-03-01',
        status: 'COMPLETED',
        provider_id: PROVIDER,
        bp_systolic: 120,
        bp_diastolic: 80,
        weight_kg: 65.5,
        height_cm: 165,
        fundal_height_cm: null,
        fetal_heart_rate: 140,
        gestational_age_weeks: 28,
        next_visit_date: '2026-03-29',
        notes: null,
        is_high_risk: false,
        created_at: NOW,
        updated_at: NOW,
        ...overrides,
    };
}

type MockClient = { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };

function makeMock(): { client: MockClient; pool: Pool; repo: VisitRepository } {
    const client: MockClient = { query: vi.fn(), release: vi.fn() };
    const pool = { connect: vi.fn().mockResolvedValue(client), query: vi.fn(), end: vi.fn() } as unknown as Pool;
    return { client, pool, repo: new VisitRepository(pool) };
}

function resolveByPattern(client: MockClient, patterns: Record<string, QueryResult>) {
    client.query.mockImplementation((sql: string) => {
        const s = typeof sql === 'string' ? sql.trim() : '';
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(s)) return Promise.resolve({ rows: [] });
        if (s.startsWith('SET LOCAL')) return Promise.resolve({ rows: [] });
        for (const [p, r] of Object.entries(patterns)) {
            if (s.includes(p)) return Promise.resolve(r);
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
    });
}

describe('VisitRepository', () => {
    // ── create ──────────────────────────────────────────────────────
    describe('create', () => {
        it('inserts a visit and returns DTO with next_visit_date', async () => {
            const { client, repo } = makeMock();
            resolveByPattern(client, {
                'INSERT INTO anc_visits': { rows: [makeVisitRow()], rowCount: 1 } as QueryResult,
            });
            const dto = await repo.create(TENANT, PATIENT, PROVIDER, { gestational_age_weeks: 28 });

            expect(dto.id).toBe('v-001');
            expect(dto.next_visit_date).toBe('2026-03-29');
            expect(dto.gestational_age_weeks).toBe(28);
            expect(dto.visit_number).toBe(1);
        });

        it('passes all optional vitals to DB', async () => {
            const { client, repo } = makeMock();
            resolveByPattern(client, {
                'INSERT INTO anc_visits': { rows: [makeVisitRow()], rowCount: 1 } as QueryResult,
            });
            await repo.create(TENANT, PATIENT, PROVIDER, {
                gestational_age_weeks: 28,
                bp_systolic: 120,
                bp_diastolic: 80,
                weight_kg: 65.5,
                height_cm: 165,
                fundal_height_cm: 30,
                fetal_heart_rate: 140,
                notes: 'Normal',
            });
            const insertCall = client.query.mock.calls.find(
                (c: unknown[]) => (c[0] as string).includes('INSERT INTO anc_visits'),
            );
            expect(insertCall![1]).toHaveLength(12);
        });

        it('rolls back on failure', async () => {
            const { client, repo } = makeMock();
            client.query.mockImplementation((sql: string) => {
                const s = sql.trim();
                if (s === 'BEGIN' || s === 'ROLLBACK') return Promise.resolve({ rows: [] });
                if (s.startsWith('SET LOCAL')) return Promise.resolve({ rows: [] });
                throw new Error('constraint violation');
            });
            await expect(repo.create(TENANT, PATIENT, PROVIDER, { gestational_age_weeks: 28 }))
                .rejects.toThrow('constraint violation');
            expect(client.release).toHaveBeenCalled();
        });

        it('defaults visit_date to null (DB uses CURRENT_DATE)', async () => {
            const { client, repo } = makeMock();
            resolveByPattern(client, {
                'INSERT INTO anc_visits': { rows: [makeVisitRow()], rowCount: 1 } as QueryResult,
            });
            await repo.create(TENANT, PATIENT, null, { gestational_age_weeks: 28 });
            const insertCall = client.query.mock.calls.find(
                (c: unknown[]) => (c[0] as string).includes('INSERT INTO anc_visits'),
            );
            // visit_date param (index 2) should be null
            expect(insertCall![1][2]).toBeNull();
        });
    });

    // ── listByPatient ───────────────────────────────────────────────
    describe('listByPatient', () => {
        it('returns array of visit DTOs', async () => {
            const { client, repo } = makeMock();
            resolveByPattern(client, {
                'SELECT * FROM anc_visits': {
                    rows: [makeVisitRow(), makeVisitRow({ id: 'v-002', visit_number: 2 })],
                    rowCount: 2,
                } as QueryResult,
            });
            const list = await repo.listByPatient(TENANT, PATIENT);
            expect(list).toHaveLength(2);
            expect(list[0].created_at).toMatch(/^\d{4}-/); // ISO string
        });

        it('returns empty array when no visits', async () => {
            const { client, repo } = makeMock();
            resolveByPattern(client, {
                'SELECT * FROM anc_visits': { rows: [], rowCount: 0 } as QueryResult,
            });
            const list = await repo.listByPatient(TENANT, PATIENT);
            expect(list).toEqual([]);
        });

        it('releases client even on error', async () => {
            const { client, repo } = makeMock();
            client.query.mockImplementation((sql: string) => {
                const s = sql.trim();
                if (s === 'BEGIN' || s === 'ROLLBACK') return Promise.resolve({ rows: [] });
                if (s.startsWith('SET LOCAL')) return Promise.resolve({ rows: [] });
                throw new Error('connection lost');
            });
            await expect(repo.listByPatient(TENANT, PATIENT)).rejects.toThrow();
            expect(client.release).toHaveBeenCalled();
        });
    });
});
