import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env.ts so Zod doesn't fail on missing DATABASE_URL during import
vi.mock('../../src/config/env.js', () => ({
    env: {
        DATABASE_URL: 'postgres://mock:mock@localhost:5432/test',
        VAULT_TOKEN: 'test-vault-token',
        REDIS_URL: 'redis://localhost:6379'
    }
}));

import { UssdService } from '../../src/services/ussd.service.js';
import * as redisModule from '../../src/config/redis.js';

describe('USSD State Machine Service', () => {

    const mockRedis = {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(redisModule, 'getRedisClient').mockReturnValue(mockRedis as any);
    });

    it('should correctly output the initial menu and set state to MENU_MAIN', async () => {
        mockRedis.get.mockResolvedValueOnce(null);

        const response = await UssdService.handleUssdCallback('session-123', '+254700000000', '');

        expect(response).toMatch(/^CON Welcome/);
        expect(response).toContain('1. Log Symptom');

        expect(mockRedis.set).toHaveBeenCalledTimes(1);
        const savedState = JSON.parse(mockRedis.set.mock.calls[0][1]);
        expect(savedState.state).toBe('MENU_MAIN');
    });

    it('should progress to MENU_LOG_SYMPTOM on choice 1', async () => {
        mockRedis.get.mockResolvedValueOnce(JSON.stringify({
            state: 'MENU_MAIN',
            phoneNumber: '+254700000000',
            lastUpdated: Date.now()
        }));

        // AT normally concatenates with asterisks
        const response = await UssdService.handleUssdCallback('session-123', '+254700000000', '1');

        expect(response).toMatch(/^CON Which symptom/);
        expect(response).toContain('1. Bleeding');

        expect(mockRedis.set).toHaveBeenCalledTimes(1);
        const savedState = JSON.parse(mockRedis.set.mock.calls[0][1]);
        expect(savedState.state).toBe('MENU_LOG_SYMPTOM');
    });

    it('should handle multi-step concatenation properly (1*1)', async () => {
        // Assume they just pressed 1 (Bleeding) from the symptom menu
        mockRedis.get.mockResolvedValueOnce(JSON.stringify({
            state: 'MENU_LOG_SYMPTOM',
            phoneNumber: '+254700000000',
            lastUpdated: Date.now()
        }));

        const response = await UssdService.handleUssdCallback('session-123', '+254700000000', '1*1');

        expect(response).toMatch(/^CON Severity of BLEEDING/);
        expect(response).toContain('3. Severe');

        expect(mockRedis.set).toHaveBeenCalledTimes(1);
        const savedState = JSON.parse(mockRedis.set.mock.calls[0][1]);
        expect(savedState.state).toBe('MENU_LOG_SEVERITY');
        expect(savedState.symptom).toBe('BLEEDING');
    });

    it('should terminate the session with END upon completion', async () => {
        mockRedis.get.mockResolvedValueOnce(JSON.stringify({
            state: 'MENU_LOG_SEVERITY',
            phoneNumber: '+254700000000',
            symptom: 'BLEEDING',
            lastUpdated: Date.now()
        }));

        const response = await UssdService.handleUssdCallback('session-123', '+254700000000', '1*1*3');

        expect(response).toMatch(/^END Thank you. Logged BLEEDING \(SEVERE\)/);

        // Terminus state triggers deletion
        expect(mockRedis.del).toHaveBeenCalledTimes(1);
        expect(mockRedis.del).toHaveBeenCalledWith('ussd:session:session-123');
        expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should terminate the session on informational submenus like My Risk Status (2)', async () => {
        mockRedis.get.mockResolvedValueOnce(JSON.stringify({
            state: 'MENU_MAIN',
            phoneNumber: '+254700000000',
            lastUpdated: Date.now()
        }));

        const response = await UssdService.handleUssdCallback('session-123', '+254700000000', '2');

        expect(response).toMatch(/^END Your latest Risk Tier/);
        expect(mockRedis.del).toHaveBeenCalledTimes(1);
    });

    it('should reject invalid menu options and maintain state appropriately', async () => {
        mockRedis.get.mockResolvedValueOnce(JSON.stringify({
            state: 'MENU_MAIN',
            phoneNumber: '+254700000000',
            lastUpdated: Date.now()
        }));

        // Option 9 does not exist
        const response = await UssdService.handleUssdCallback('session-123', '+254700000000', '9');

        expect(response).toMatch(/^CON Invalid Choice/);

        expect(mockRedis.set).toHaveBeenCalledTimes(1);
        const savedState = JSON.parse(mockRedis.set.mock.calls[0][1]);
        // State should remain on MENU_MAIN
        expect(savedState.state).toBe('MENU_MAIN');
    });
});
