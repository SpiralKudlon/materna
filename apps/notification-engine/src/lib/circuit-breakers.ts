/**
 * circuit-breakers.ts — opossum circuit breakers for external SMS/Voice/FCM providers
 *
 * Breakers:
 *   atSmsBreaker   – Africa's Talking SMS.send
 *   atVoiceBreaker – Africa's Talking VOICE.call
 *   fcmBreaker     – Firebase messaging().send
 *
 * Configuration (per requirement):
 *   errorThresholdPercentage: 50  (opens when ≥ 50% of calls fail)
 *   volumeThreshold:          5   (needs at least 5 calls to evaluate)
 *   timeout:                  10_000ms (10s window per call)
 *   resetTimeout:             30_000ms (half‑open attempt after 30s)
 *
 * State reporting → Prometheus gauge `circuit_state`  0=closed 1=half‑open 2=open
 */
import CircuitBreaker from 'opossum';
import {
  circuitStateGauge,
  circuitFallbackCounter,
} from './metrics.js';

// ── Breaker config shared across all external providers ───────────────────────
const BREAKER_OPTIONS: CircuitBreaker.Options = {
  errorThresholdPercentage: 50,   // open after 50% failure rate…
  volumeThreshold: 5,             // …but only once ≥5 calls evaluated
  timeout: 10_000,                // individual call timeout: 10s
  resetTimeout: 30_000,           // half‑open retry window: 30s
};

// ── Helper: wire Prometheus state tracking to a breaker ──────────────────────
function attachMetrics(breaker: CircuitBreaker, name: string): void {
  // Start closed (0)
  circuitStateGauge.labels(name).set(0);

  breaker.on('open', () => {
    circuitStateGauge.labels(name).set(2);
    console.error(`[CircuitBreaker] ${name} OPENED — provider unreachable`);
  });
  breaker.on('halfOpen', () => {
    circuitStateGauge.labels(name).set(1);
    console.warn(`[CircuitBreaker] ${name} HALF‑OPEN — testing recovery`);
  });
  breaker.on('close', () => {
    circuitStateGauge.labels(name).set(0);
    console.log(`[CircuitBreaker] ${name} CLOSED — provider healthy`);
  });
  breaker.on('fallback', () => {
    circuitFallbackCounter.labels(name).inc();
    console.warn(`[CircuitBreaker] ${name} fallback triggered`);
  });
}

// ── Africa's Talking SMS ──────────────────────────────────────────────────────
type AtSmsPayload = { to: string[]; message: string; from?: string };

export function createAtSmsBreaker(
  sendFn: (payload: AtSmsPayload) => Promise<unknown>,
) {
  const breaker = new CircuitBreaker(sendFn, {
    ...BREAKER_OPTIONS,
    name: 'atSms',
  });

  breaker.fallback((_payload: AtSmsPayload, err: Error) => {
    console.error(`[atSmsBreaker] SMS NOT delivered — circuit open. Error: ${err?.message}`);
    // Return a resolved value so the worker job doesn't hard‑fail when circuit is open.
    // BullMQ retry policy will still apply if the calling code explicitly throws.
    return { dropped: true, reason: 'circuit_open' };
  });

  attachMetrics(breaker, 'atSms');
  return breaker;
}

// ── Africa's Talking Voice ────────────────────────────────────────────────────
type AtVoicePayload = { callFrom: string; callTo: string[] };

export function createAtVoiceBreaker(
  callFn: (payload: AtVoicePayload) => Promise<unknown>,
  smsFallback: (payload: AtSmsPayload) => Promise<unknown>,
  virtualNumber: string,
) {
  const breaker = new CircuitBreaker(callFn, {
    ...BREAKER_OPTIONS,
    name: 'atVoice',
  });

  // Fallback: if voice circuit is open, escalate to SMS
  breaker.fallback(async (payload: AtVoicePayload, err: Error) => {
    console.error(`[atVoiceBreaker] Voice FAILED — escalating to SMS. Error: ${err?.message}`);
    const smsPayload: AtSmsPayload = {
      to: payload.callTo,
      message: '🚨 EMERGENCY SOS: A patient requires immediate assistance. Please call immediately.',
      from: virtualNumber,
    };
    return smsFallback(smsPayload);
  });

  attachMetrics(breaker, 'atVoice');
  return breaker;
}

// ── Firebase FCM ──────────────────────────────────────────────────────────────
type FcmPayload = Parameters<ReturnType<typeof import('firebase-admin').messaging>['send']>[0];

export function createFcmBreaker(
  sendFn: (msg: FcmPayload) => Promise<string>,
  smsFallback: ((payload: AtSmsPayload) => Promise<unknown>) | null,
  chvPhone: string | null,
  virtualNumber: string,
) {
  const breaker = new CircuitBreaker(sendFn as (msg: FcmPayload) => Promise<unknown>, {
    ...BREAKER_OPTIONS,
    name: 'fcm',
  });

  breaker.fallback(async (_msg: FcmPayload, err: Error) => {
    console.error(`[fcmBreaker] FCM push FAILED — falling back to CHV SMS. Error: ${err?.message}`);
    if (smsFallback && chvPhone) {
      return smsFallback({
        to: [chvPhone],
        message: '🚨 HIGH RISK ALERT: A patient on your list has been flagged. Please check the app immediately.',
        from: virtualNumber,
      });
    }
  });

  attachMetrics(breaker, 'fcm');
  return breaker;
}
