/**
 * tests/unit/audit-context.test.ts
 *
 * Unit tests for setAuditContext() — verifies that the correct SET LOCAL
 * statements are issued and that null/empty values are handled safely.
 */
import { describe, it, expect, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { setAuditContext } from '../../src/services/audit-context.service.js';

function makeMockClient() {
    const queries: { sql: string; params: unknown[] }[] = [];
    const client = {
        query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
            queries.push({ sql, params: params ?? [] });
            return Promise.resolve({ rows: [], rowCount: 0 });
        }),
    } as unknown as PoolClient;
    return { client, queries };
}

describe('setAuditContext()', () => {

    it('calls client.query with a DO block containing all four set_config calls', async () => {
        const { client, queries } = makeMockClient();

        await setAuditContext(client, {
            userId: 'user-123',
            tenantId: '00000000-0000-0000-0000-000000000001',
            ip: '192.168.1.10',
            userAgent: 'Mozilla/5.0',
        });

        expect(queries).toHaveLength(1);
        const { sql, params } = queries[0];

        // The SQL must contain set_config for each session variable
        expect(sql).toContain('app.current_user_id');
        expect(sql).toContain('app.current_tenant_id');
        expect(sql).toContain('app.client_ip');
        expect(sql).toContain('app.client_user_agent');

        // All four values passed as positional params
        expect(params).toHaveLength(4);
        expect(params[0]).toBe('user-123');
        expect(params[1]).toBe('00000000-0000-0000-0000-000000000001');
        expect(params[2]).toBe('192.168.1.10');
        expect(params[3]).toBe('Mozilla/5.0');
    });

    it('converts null values to empty strings so current_setting() never throws', async () => {
        const { client, queries } = makeMockClient();

        await setAuditContext(client, {
            userId: null,
            tenantId: null,
            ip: null,
            userAgent: null,
        });

        const { params } = queries[0];
        expect(params).toEqual(['', '', '', '']);
    });

    it('converts undefined values to empty strings', async () => {
        const { client, queries } = makeMockClient();

        await setAuditContext(client, {
            userId: undefined,
            tenantId: undefined,
            ip: undefined,
            userAgent: undefined,
        });

        const { params } = queries[0];
        expect(params).toEqual(['', '', '', '']);
    });

    it('issues exactly one query (single round-trip)', async () => {
        const { client, queries } = makeMockClient();

        await setAuditContext(client, {
            userId: 'u1', tenantId: 't1', ip: '127.0.0.1', userAgent: 'curl/7.88',
        });

        expect(queries).toHaveLength(1);
    });

    it('resolves without throwing for valid context', async () => {
        const { client } = makeMockClient();

        await expect(
            setAuditContext(client, {
                userId: 'u1', tenantId: 't1', ip: '10.0.0.1', userAgent: 'test-agent',
            })
        ).resolves.toBeUndefined();
    });
});
