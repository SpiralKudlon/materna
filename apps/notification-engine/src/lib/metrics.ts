/**
 * metrics.ts — Prometheus metrics registry for the notification-engine
 *
 * Metrics exported:
 *   circuit_state             Gauge  – 0=closed, 1=half‑open, 2=open  (label: breaker)
 *   circuit_fallback_total    Counter – incremented whenever a breaker uses its fallback
 *   pg_pool_utilization_ratio Gauge  – totalConnections / max (0‑1)
 *   pg_pool_waiting_count     Gauge  – clients waiting for a free connection
 */
import { Registry, Gauge, Counter, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();

// Collect default Node.js process metrics (heap, eventloop lag, etc.)
collectDefaultMetrics({ register: registry });

// ── Circuit breaker state ─────────────────────────────────────────────────────
export const circuitStateGauge = new Gauge({
  name: 'circuit_state',
  help: 'State of each circuit breaker: 0=closed, 1=half‑open, 2=open',
  labelNames: ['breaker'] as const,
  registers: [registry],
});

export const circuitFallbackCounter = new Counter({
  name: 'circuit_fallback_total',
  help: 'Total number of times a circuit breaker fallback was triggered',
  labelNames: ['breaker'] as const,
  registers: [registry],
});

// ── PostgreSQL pool ───────────────────────────────────────────────────────────
export const pgPoolUtilization = new Gauge({
  name: 'pg_pool_utilization_ratio',
  help: 'Ratio of active PG connections to pool max (0‑1).  Alert at > 0.90.',
  registers: [registry],
});

export const pgPoolWaiting = new Gauge({
  name: 'pg_pool_waiting_count',
  help: 'Number of clients currently waiting for a PG connection from the pool',
  registers: [registry],
});

export const POOL_MAX = 20; // must match what pg.Pool is configured with
