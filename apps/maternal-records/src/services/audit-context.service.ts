/**
 * audit-context.service.ts
 *
 * Injects per-request audit context into the PostgreSQL session via SET LOCAL.
 * Must be called inside an open transaction (after BEGIN) so the settings
 * are scoped to the transaction and automatically reset on COMMIT/ROLLBACK.
 *
 * The `record_audit_event` trigger function reads these settings via
 * `current_setting('app.X', true)` on every INSERT/UPDATE/DELETE.
 */
import type { PoolClient } from 'pg';

export interface AuditContext {
    /** The authenticated user's ID (from x-user-id header / JWT). */
    userId: string | null | undefined;
    /** The tenant UUID (from x-tenant-id header). */
    tenantId: string | null | undefined;
    /** Client IP address (from Fastify request.ip). */
    ip: string | null | undefined;
    /** HTTP User-Agent header value. */
    userAgent: string | null | undefined;
}

/**
 * Issues four SET LOCAL statements inside the current transaction, making
 * the audit context available to the `record_audit_event` trigger function.
 *
 * Empty/null values are stored as empty strings so that
 * `current_setting('app.X', true)` never throws.
 */
export async function setAuditContext(
    client: PoolClient,
    ctx: AuditContext,
): Promise<void> {
    // Emit all four SET LOCALs in a single round-trip using a DO block.
    await client.query(`
        DO $$
        BEGIN
            PERFORM set_config('app.current_user_id',   $1, true);
            PERFORM set_config('app.current_tenant_id', $2, true);
            PERFORM set_config('app.client_ip',         $3, true);
            PERFORM set_config('app.client_user_agent', $4, true);
        END$$;
    `, [
        ctx.userId ?? '',
        ctx.tenantId ?? '',
        ctx.ip ?? '',
        ctx.userAgent ?? '',
    ]);
}
