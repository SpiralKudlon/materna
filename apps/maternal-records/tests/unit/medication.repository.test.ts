/**
 * Unit tests for MedicationRepository.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool, QueryResult } from 'pg';
import { MedicationRepository, type MedicationLogRow } from '../../src/repositories/medication.repository.js';

const TENANT = 't-001';
const PATIENT = 'p-001';
const NOW = new Date('2026-03-04');

function makeMedLogRow(overrides: Partial<MedicationLogRow> = {}): MedicationLogRow {
    return {
        id: 'm-001',
        patient_id: PATIENT,
        tenant_id: TENANT,
        medication_name: 'Iron Supplement',
        action: 'TAKEN',
        scheduled_at: null,
        notes: null,
        created_at: NOW,
        ...overrides,
    };
}

const STATS_ROW = { total: '7', taken: '5', skipped: '2' };

type MockClient = { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };

function makeMock(): { client: MockClient; pool: Pool; repo: MedicationRepository } {
    const client: MockClient = { query: vi.fn(), release: vi.fn() };
    const pool = {
        connect: vi.fn().mockResolvedValue(client),
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        end: vi.fn(),
    } as unknown as Pool;
    return { client, pool, repo: new MedicationRepository(pool) };
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

describe('MedicationRepository', () => {
    // ── ensureTable ─────────────────────────────────────────────────
    describe('ensureTable', () => {
        it('executes CREATE TABLE IF NOT EXISTS', async () => {
            const { pool, repo } = makeMock();
            await repo.ensureTable();
            expect(pool.query).toHaveBeenCalledTimes(1);
            const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
            expect(sql).toContain('CREATE TABLE IF NOT EXISTS medication_logs');
        });
    });

    // ── log ─────────────────────────────────────────────────────────
    describe('log', () => {
        it('inserts a TAKEN log and returns entry + adherence stats', async () => {
            const { client, repo } = makeMock();
            resolveByPattern(client, {
                'INSERT INTO medication_logs': { rows: [makeMedLogRow()], rowCount: 1 } as QueryResult,
                'COUNT(*)': { rows: [STATS_ROW], rowCount: 1 } as QueryResult,
            });

            const result = await repo.log(TENANT, PATIENT, {
                medication_name: 'Iron Supplement',
                action: 'TAKEN',
            });

            expect(result.entry.medication_name).toBe('Iron Supplement');
            expect(result.entry.action).toBe('TAKEN');
            expect(result.adherence.total_logs_7d).toBe(7);
            expect(result.adherence.taken_count).toBe(5);
            expect(result.adherence.skipped_count).toBe(2);
            expect(result.adherence.adherence_rate_7d).toBe(0.71);
        });

        it('inserts a SKIPPED log', async () => {
            const { client, repo } = makeMock();
            const row = makeMedLogRow({ action: 'SKIPPED' });
            resolveByPattern(client, {
                'INSERT INTO medication_logs': { rows: [row], rowCount: 1 } as QueryResult,
                'COUNT(*)': { rows: [{ total: '3', taken: '1', skipped: '2' }], rowCount: 1 } as QueryResult,
            });

            const result = await repo.log(TENANT, PATIENT, {
                medication_name: 'Iron Supplement',
                action: 'SKIPPED',
                notes: 'Nausea',
            });

            expect(result.entry.action).toBe('SKIPPED');
            expect(result.adherence.adherence_rate_7d).toBe(0.33);
        });

        it('handles zero total (never logged before)', async () => {
            const { client, repo } = makeMock();
            resolveByPattern(client, {
                'INSERT INTO medication_logs': { rows: [makeMedLogRow()], rowCount: 1 } as QueryResult,
                'COUNT(*)': { rows: [{ total: '0', taken: '0', skipped: '0' }], rowCount: 1 } as QueryResult,
            });

            const result = await repo.log(TENANT, PATIENT, {
                medication_name: 'Folic Acid',
                action: 'TAKEN',
            });
            // Should not divide by zero
            expect(result.adherence.adherence_rate_7d).toBe(0);
        });

        it('rolls back on insert failure', async () => {
            const { client, repo } = makeMock();
            client.query.mockImplementation((sql: string) => {
                const s = sql.trim();
                if (s === 'BEGIN' || s === 'ROLLBACK') return Promise.resolve({ rows: [] });
                if (s.startsWith('SET LOCAL')) return Promise.resolve({ rows: [] });
                throw new Error('FK violation');
            });
            await expect(
                repo.log(TENANT, PATIENT, { medication_name: 'X', action: 'TAKEN' }),
            ).rejects.toThrow('FK violation');
            expect(client.release).toHaveBeenCalled();
        });

        it('passes scheduled_at and notes through', async () => {
            const { client, repo } = makeMock();
            resolveByPattern(client, {
                'INSERT INTO medication_logs': { rows: [makeMedLogRow()], rowCount: 1 } as QueryResult,
                'COUNT(*)': { rows: [STATS_ROW], rowCount: 1 } as QueryResult,
            });
            await repo.log(TENANT, PATIENT, {
                medication_name: 'Iron',
                action: 'TAKEN',
                scheduled_at: '2026-03-04T08:00:00Z',
                notes: 'Before breakfast',
            });
            const insertCall = client.query.mock.calls.find(
                (c: unknown[]) => (c[0] as string).includes('INSERT INTO medication_logs'),
            );
            expect(insertCall![1][4]).toBe('2026-03-04T08:00:00Z');
            expect(insertCall![1][5]).toBe('Before breakfast');
        });

        it('calls BEGIN → SET LOCAL → INSERT → COUNT → COMMIT', async () => {
            const { client, repo } = makeMock();
            resolveByPattern(client, {
                'INSERT INTO medication_logs': { rows: [makeMedLogRow()], rowCount: 1 } as QueryResult,
                'COUNT(*)': { rows: [STATS_ROW], rowCount: 1 } as QueryResult,
            });
            await repo.log(TENANT, PATIENT, { medication_name: 'X', action: 'TAKEN' });

            const calls = client.query.mock.calls.map((c: unknown[]) => {
                const s = (c[0] as string).trim();
                if (s === 'BEGIN') return 'BEGIN';
                if (s === 'COMMIT') return 'COMMIT';
                if (s.startsWith('SET LOCAL')) return 'SET_LOCAL';
                if (s.includes('INSERT INTO medication_logs')) return 'INSERT';
                if (s.includes('COUNT(*)')) return 'COUNT';
                return s.substring(0, 20);
            });
            expect(calls).toEqual(['BEGIN', 'SET_LOCAL', 'INSERT', 'COUNT', 'COMMIT']);
        });
    });
});
