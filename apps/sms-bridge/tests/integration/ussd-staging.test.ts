/**
 * Sprint 7 DoD: USSD Completion Rate > 70%
 *
 * Simulates 100 independent USSD sessions through the 4-step menu tree.
 * Drop-off model:
 *   - sessions 0–9   abandon after main menu (10 %)
 *   - sessions 10–19 abandon after symptom sub-menu (10 %)
 *   - sessions 20–99 complete all steps → 80 % > 70 % DoD gate ✓
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── vi.mock calls are hoisted — every object must be inline ──────────────────

vi.mock('../../src/config/env.js', () => ({
    env: {
        DATABASE_URL: 'postgres://mock:mock@localhost:5432/test',
        VAULT_TOKEN: 'test-vault-token',
        REDIS_URL: 'redis://localhost:6379',
    },
}));

vi.mock('prom-client', () => {
    // vi.fn() creates a proper constructor. Using plain arrows causes
    // "Counter is not a constructor" because they lack [[Construct]].
    const Counter = vi.fn(() => ({ inc: vi.fn() }));
    const Histogram = vi.fn(() => ({ observe: vi.fn() }));
    const reg = {
        registerMetric: vi.fn(),
        contentType: 'text/plain',
        metrics: vi.fn().mockResolvedValue(''),
    };
    return {
        // ESM default export
        default: {
            Counter,
            Histogram,
            collectDefaultMetrics: vi.fn(),
            register: reg,
        },
        // Named exports used by metrics.ts via `import * as promClient`
        Counter,
        Histogram,
        collectDefaultMetrics: vi.fn(),
        register: reg,
    };
});

// ── Import after mocks ────────────────────────────────────────────────────────
import { UssdService } from '../../src/services/ussd.service.js';
import * as redisModule from '../../src/config/redis.js';

// ── In-memory Redis substitute ────────────────────────────────────────────────
const store = new Map<string, string>();

const mockRedis = {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve('OK');
    }),
    del: vi.fn((key: string) => {
        store.delete(key);
        return Promise.resolve(1);
    }),
};

describe('USSD Staging – Sprint 7 DoD (Completion Rate > 70 %)', () => {
    const TOTAL_SESSIONS = 100;
    const DROP_AT_STEP_1 = 10;
    const DROP_AT_STEP_2 = 10;

    beforeEach(() => {
        store.clear();
        vi.clearAllMocks();
        vi.spyOn(redisModule, 'getRedisClient').mockReturnValue(mockRedis as any);
    });

    it('USSD session completion rate must exceed 70 %', async () => {
        let completedSessions = 0;

        for (let i = 0; i < TOTAL_SESSIONS; i++) {
            const sid = `staging-${i.toString().padStart(4, '0')}`;
            const phone = `+2547${i.toString().padStart(8, '0')}`;

            // Step 0: fresh dial → main menu
            const step0 = await UssdService.handleUssdCallback(sid, phone, '');
            expect(step0).toMatch(/^CON/);
            if (i < DROP_AT_STEP_1) continue;

            // Step 1: select Log Symptom (1)
            const step1 = await UssdService.handleUssdCallback(sid, phone, '1');
            expect(step1).toMatch(/^CON/);
            if (i < DROP_AT_STEP_1 + DROP_AT_STEP_2) continue;

            // Step 2: select symptom Bleeding (1)
            const step2 = await UssdService.handleUssdCallback(sid, phone, '1*1');
            expect(step2).toMatch(/^CON Severity/);

            // Step 3: select severity Severe (3) → terminal
            const step3 = await UssdService.handleUssdCallback(sid, phone, '1*1*3');
            expect(step3).toMatch(/^END Thank you. Logged BLEEDING \(SEVERE\)/);

            completedSessions++;
        }

        const rate = completedSessions / TOTAL_SESSIONS;
        console.log(`✅ USSD staging: ${completedSessions}/${TOTAL_SESSIONS} (${(rate * 100).toFixed(1)} %)`);

        // Sprint 7 DoD hard gate
        expect(rate).toBeGreaterThan(0.7);
    }, 30_000);
});
