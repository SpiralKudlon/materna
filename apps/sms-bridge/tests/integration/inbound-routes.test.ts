import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

vi.mock('../../src/config/env.js', () => ({
    env: {
        DATABASE_URL: 'postgres://mock:mock@localhost:5432/test',
        VAULT_TOKEN: 'test-vault-token',
        REDIS_URL: 'redis://localhost:6379'
    }
}));

// Mock Vault Secrets dynamically early enough
vi.mock('../../src/config/vault.js', () => ({
    getSmsSecrets: vi.fn().mockResolvedValue({
        TWILIO_ACCOUNT_SID: 'ACtwilio-sid',
        TWILIO_AUTH_TOKEN: 'twilio-token',
        TWILIO_FROM_NUMBER: '+1234567890',
        AT_API_KEY: 'at-api-key',
        AT_USERNAME: 'sandbox',
        AT_SENDER_ID: 'MATERNAL'
    })
}));

// Mock USSD Service internally to avoid hitting Redis
vi.mock('../../src/services/ussd.service.js', () => ({
    UssdService: {
        handleUssdCallback: vi.fn().mockResolvedValue('CON Welcome')
    }
}));

import { buildApp } from '../../src/server.js';
import type { FastifyInstance } from 'fastify';

describe('Inbound SMS & USSD Webhooks API', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildApp();
    });

    afterAll(async () => {
        await app.close();
    });

    it('POST /api/v1/sms/inbound - successfully parses and responds to STATUS command', async () => {
        const payload = {
            from: '+254700000001',
            to: '20123',
            text: 'STATUS',
            date: '2026-03-01',
            id: 'message-123'
        };

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/sms/inbound',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            payload: new URLSearchParams(payload).toString(),
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.success).toBe(true);
    });

    it('POST /api/v1/sms/inbound - successfully parses fuzzy LOG SYMPTOM', async () => {
        const payload = {
            from: '+254700000001',
            to: '20123',
            text: 'LOG HEDACHE SEVERE',
            date: '2026-03-01',
            id: 'message-124'
        };

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/sms/inbound',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            payload: new URLSearchParams(payload).toString(),
        });

        expect(response.statusCode).toBe(200);
    });

    it('POST /api/v1/ussd/callback - successfully returns text/plain state string', async () => {
        const payload = {
            sessionId: 'session-456',
            phoneNumber: '+254700000001',
            networkCode: '04',
            serviceCode: '*384*1#',
            text: '' // Initial prompt
        };

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/ussd/callback',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            payload: new URLSearchParams(payload).toString(),
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/plain');
        expect(response.payload).toMatch(/^CON Welcome/);
    });
});
