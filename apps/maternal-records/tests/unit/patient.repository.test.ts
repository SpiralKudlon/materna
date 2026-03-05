/**
 * Unit tests for PatientRepository.
 *
 * Strategy: mock Pool → mock PoolClient → verify SQL dispatch,
 * argument passing, transaction lifecycle, and error paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool, PoolClient, QueryResult } from 'pg';
import { PatientRepository, type PatientRow } from '../../src/repositories/patient.repository.js';

// ── Helpers ────────────────────────────────────────────────────────────

const TENANT = 't-001';
const USER = 'u-001';
const PATIENT = 'p-001';
const NOW = new Date('2026-03-01');

function makePatientRow(overrides: Partial<PatientRow> = {}): PatientRow {
    return {
        id: PATIENT,
        tenant_id: TENANT,
        full_name_enc: Buffer.from('Jane Doe'),
        phone_enc: Buffer.from('+254700000000'),
        date_of_birth: '1990-01-01',
        sex: 'F',
        national_id: null,
        registered_by: USER,
        created_at: NOW,
        updated_at: NOW,
        ...overrides,
    };
}

type MockClient = {
    query: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
};

function makeMockClient(): MockClient {
    return {
        query: vi.fn(),
        release: vi.fn(),
    };
}

function makeMockPool(client: MockClient): Pool {
    return {
        connect: vi.fn().mockResolvedValue(client),
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        end: vi.fn(),
    } as unknown as Pool;
}

function resolveQueryByPattern(client: MockClient, patterns: Record<string, QueryResult>) {
    client.query.mockImplementation((sql: string) => {
        const s = typeof sql === 'string' ? sql.trim() : '';
        // Transaction commands
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(s)) return Promise.resolve({ rows: [], rowCount: 0 });
        if (s.startsWith('SET LOCAL')) return Promise.resolve({ rows: [], rowCount: 0 });

        for (const [pattern, result] of Object.entries(patterns)) {
            if (s.includes(pattern)) return Promise.resolve(result);
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
    });
}

// ══════════════════════════════════════════════════════════════════════

describe('PatientRepository', () => {
    let client: MockClient;
    let pool: Pool;
    let repo: PatientRepository;

    beforeEach(() => {
        client = makeMockClient();
        pool = makeMockPool(client);
        repo = new PatientRepository(pool);
    });

    // ── create ──────────────────────────────────────────────────────
    describe('create', () => {
        it('inserts a patient and returns DTO', async () => {
            const row = makePatientRow();
            resolveQueryByPattern(client, {
                'INSERT INTO patients': { rows: [row], rowCount: 1 } as QueryResult,
            });

            const dto = await repo.create(TENANT, USER, { full_name: 'Jane Doe', phone: '+254700000000' });
            expect(dto.id).toBe(PATIENT);
            expect(dto.full_name).toBe('Jane Doe');
            expect(dto.phone).toBe('+254700000000');
            // Verify raw encrypted fields are NOT exposed
            expect(dto).not.toHaveProperty('full_name_enc');
            expect(dto).not.toHaveProperty('phone_enc');
        });

        it('calls BEGIN → SET LOCAL → INSERT → COMMIT', async () => {
            resolveQueryByPattern(client, {
                'INSERT INTO patients': { rows: [makePatientRow()], rowCount: 1 } as QueryResult,
            });
            await repo.create(TENANT, USER, { full_name: 'X', phone: '0' });

            const calls = client.query.mock.calls.map((c: unknown[]) => (c[0] as string).trim().substring(0, 20));
            expect(calls[0]).toBe('BEGIN');
            expect(calls[1]).toContain('SET LOCAL');
            expect(calls[2]).toContain('INSERT INTO patients');
            expect(calls[3]).toBe('COMMIT');
        });

        it('rolls back on insert failure and releases client', async () => {
            client.query.mockImplementation((sql: string) => {
                const s = sql.trim();
                if (s === 'BEGIN' || s === 'ROLLBACK') return Promise.resolve({ rows: [] });
                if (s.startsWith('SET LOCAL')) return Promise.resolve({ rows: [] });
                throw new Error('DB error');
            });

            await expect(repo.create(TENANT, USER, { full_name: 'X', phone: '0' })).rejects.toThrow('DB error');
            expect(client.release).toHaveBeenCalled();
            // ROLLBACK should have been called
            const calls = client.query.mock.calls.map((c: unknown[]) => (c[0] as string).trim());
            expect(calls).toContain('ROLLBACK');
        });

        it('passes optional fields (dob, sex, national_id)', async () => {
            resolveQueryByPattern(client, {
                'INSERT INTO patients': { rows: [makePatientRow()], rowCount: 1 } as QueryResult,
            });
            await repo.create(TENANT, USER, {
                full_name: 'Jane',
                phone: '+254',
                date_of_birth: '1990-01-01',
                sex: 'F',
                national_id: 'NID123',
            });
            // The INSERT call should have 7 bind params
            const insertCall = client.query.mock.calls.find(
                (c: unknown[]) => (c[0] as string).includes('INSERT INTO patients'),
            );
            expect(insertCall![1]).toHaveLength(7);
            expect(insertCall![1][3]).toBe('1990-01-01');
            expect(insertCall![1][4]).toBe('F');
            expect(insertCall![1][5]).toBe('NID123');
        });
    });

    // ── findById ────────────────────────────────────────────────────
    describe('findById', () => {
        it('returns patient DTO when found and assigned', async () => {
            resolveQueryByPattern(client, {
                'SELECT 1': { rows: [{ '?column?': 1 }], rowCount: 1 } as QueryResult,
                'SELECT * FROM patients': { rows: [makePatientRow()], rowCount: 1 } as QueryResult,
            });
            const dto = await repo.findById(TENANT, USER, PATIENT);
            expect(dto).not.toBeNull();
            expect(dto!.id).toBe(PATIENT);
        });

        it('throws FORBIDDEN when user not assigned', async () => {
            resolveQueryByPattern(client, {
                'SELECT 1': { rows: [], rowCount: 0 } as QueryResult,
            });
            await expect(repo.findById(TENANT, USER, PATIENT)).rejects.toThrow('Forbidden');
        });

        it('returns null when patient does not exist', async () => {
            resolveQueryByPattern(client, {
                'SELECT 1': { rows: [{ '?column?': 1 }], rowCount: 1 } as QueryResult,
                'SELECT * FROM patients': { rows: [], rowCount: 0 } as QueryResult,
            });
            const dto = await repo.findById(TENANT, USER, PATIENT);
            expect(dto).toBeNull();
        });
    });

    // ── listByTenant ────────────────────────────────────────────────
    describe('listByTenant', () => {
        it('returns an array of DTOs', async () => {
            resolveQueryByPattern(client, {
                'SELECT * FROM patients': { rows: [makePatientRow(), makePatientRow({ id: 'p-002' })], rowCount: 2 } as QueryResult,
            });
            const list = await repo.listByTenant(TENANT);
            expect(list).toHaveLength(2);
        });

        it('uses default limit=50 offset=0', async () => {
            resolveQueryByPattern(client, {
                'SELECT * FROM patients': { rows: [], rowCount: 0 } as QueryResult,
            });
            await repo.listByTenant(TENANT);
            const selectCall = client.query.mock.calls.find(
                (c: unknown[]) => (c[0] as string).includes('LIMIT'),
            );
            expect(selectCall![1]).toEqual([50, 0]);
        });

        it('forwards custom limit and offset', async () => {
            resolveQueryByPattern(client, {
                'SELECT * FROM patients': { rows: [], rowCount: 0 } as QueryResult,
            });
            await repo.listByTenant(TENANT, 10, 20);
            const selectCall = client.query.mock.calls.find(
                (c: unknown[]) => (c[0] as string).includes('LIMIT'),
            );
            expect(selectCall![1]).toEqual([10, 20]);
        });
    });

    // ── update ──────────────────────────────────────────────────────
    describe('update', () => {
        it('updates specified fields only', async () => {
            resolveQueryByPattern(client, {
                'SELECT 1': { rows: [{ '?column?': 1 }], rowCount: 1 } as QueryResult,
                'UPDATE patients': { rows: [makePatientRow({ full_name_enc: Buffer.from('Jane Smith') })], rowCount: 1 } as QueryResult,
            });
            const dto = await repo.update(TENANT, USER, PATIENT, { full_name: 'Jane Smith' });
            expect(dto.full_name).toBe('Jane Smith');
        });

        it('throws when no fields provided', async () => {
            resolveQueryByPattern(client, {
                'SELECT 1': { rows: [{ '?column?': 1 }], rowCount: 1 } as QueryResult,
            });
            await expect(repo.update(TENANT, USER, PATIENT, {})).rejects.toThrow('No fields to update');
        });

        it('builds dynamic SET with multiple fields', async () => {
            resolveQueryByPattern(client, {
                'SELECT 1': { rows: [{ '?column?': 1 }], rowCount: 1 } as QueryResult,
                'UPDATE patients': { rows: [makePatientRow()], rowCount: 1 } as QueryResult,
            });
            await repo.update(TENANT, USER, PATIENT, { full_name: 'A', phone: 'B', sex: 'M' });
            const updateCall = client.query.mock.calls.find(
                (c: unknown[]) => (c[0] as string).includes('UPDATE patients'),
            );
            const sql = updateCall![0] as string;
            expect(sql).toContain('full_name_enc');
            expect(sql).toContain('phone_enc');
            expect(sql).toContain('sex');
        });

        it('throws FORBIDDEN when user not assigned', async () => {
            resolveQueryByPattern(client, {
                'SELECT 1': { rows: [], rowCount: 0 } as QueryResult,
            });
            await expect(repo.update(TENANT, USER, PATIENT, { full_name: 'X' })).rejects.toThrow('Forbidden');
        });
    });

    // ── delete ──────────────────────────────────────────────────────
    describe('delete', () => {
        it('returns true when patient deleted', async () => {
            resolveQueryByPattern(client, {
                'SELECT 1': { rows: [{ '?column?': 1 }], rowCount: 1 } as QueryResult,
                'DELETE FROM patients': { rows: [], rowCount: 1 } as QueryResult,
            });
            const result = await repo.delete(TENANT, USER, PATIENT);
            expect(result).toBe(true);
        });

        it('returns false when patient not found', async () => {
            resolveQueryByPattern(client, {
                'SELECT 1': { rows: [{ '?column?': 1 }], rowCount: 1 } as QueryResult,
                'DELETE FROM patients': { rows: [], rowCount: 0 } as QueryResult,
            });
            const result = await repo.delete(TENANT, USER, PATIENT);
            expect(result).toBe(false);
        });

        it('always releases client even on error', async () => {
            resolveQueryByPattern(client, {
                'SELECT 1': { rows: [], rowCount: 0 } as QueryResult,
            });
            await expect(repo.delete(TENANT, USER, PATIENT)).rejects.toThrow();
            expect(client.release).toHaveBeenCalled();
        });
    });

    // ── encryption ──────────────────────────────────────────────────
    describe('encryption transparency', () => {
        it('stores plaintext as Buffer and decrypts back transparently', async () => {
            const plainName = 'Akinyi Wambui';
            const plainPhone = '+254712345678';
            const row = makePatientRow({
                full_name_enc: Buffer.from(plainName),
                phone_enc: Buffer.from(plainPhone),
            });
            resolveQueryByPattern(client, {
                'INSERT INTO patients': { rows: [row], rowCount: 1 } as QueryResult,
            });
            const dto = await repo.create(TENANT, USER, { full_name: plainName, phone: plainPhone });
            // DTO has decrypted values
            expect(dto.full_name).toBe(plainName);
            expect(dto.phone).toBe(plainPhone);
        });

        it('INSERT sends Buffer values (not plain strings) to the database', async () => {
            resolveQueryByPattern(client, {
                'INSERT INTO patients': { rows: [makePatientRow()], rowCount: 1 } as QueryResult,
            });
            await repo.create(TENANT, USER, { full_name: 'Test', phone: '000' });
            const insertCall = client.query.mock.calls.find(
                (c: unknown[]) => (c[0] as string).includes('INSERT INTO patients'),
            );
            // Params[1] = full_name_enc, Params[2] = phone_enc should be Buffers
            expect(Buffer.isBuffer(insertCall![1][1])).toBe(true);
            expect(Buffer.isBuffer(insertCall![1][2])).toBe(true);
        });
    });
});
