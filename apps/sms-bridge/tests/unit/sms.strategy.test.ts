import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmsBridgeService } from '../../src/services/sms-bridge.service.js';
import type { ISmsProvider, SendResult } from '../../src/services/sms.strategy.js';
import type { FastifyBaseLogger } from 'fastify';

// Mock Providers
class MockProvider implements ISmsProvider {
    public name: 'AfricasTalking' | 'Twilio';
    public send = vi.fn<[string, string], Promise<SendResult>>();

    constructor(name: 'AfricasTalking' | 'Twilio') {
        this.name = name;
    }
}

const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
} as unknown as FastifyBaseLogger;

describe('SmsBridgeService (Orchestrator)', () => {
    let atPrimary: MockProvider;
    let twilioSecondary: MockProvider;
    let service: SmsBridgeService;

    beforeEach(() => {
        atPrimary = new MockProvider('AfricasTalking');
        twilioSecondary = new MockProvider('Twilio');
        service = new SmsBridgeService(atPrimary, twilioSecondary, mockLogger);
        vi.clearAllMocks();
    });

    it("succeeds on first attempt via primary (Africa's Talking)", async () => {
        const expectedResult: SendResult = { messageId: 'AT-1234', provider: 'AfricasTalking', status: 'Success' };
        atPrimary.send.mockResolvedValue(expectedResult);

        const result = await service.sendWithFallback('+254700000000', 'Test message');

        expect(result).toEqual(expectedResult);
        expect(atPrimary.send).toHaveBeenCalledTimes(1);
        expect(twilioSecondary.send).not.toHaveBeenCalled();
    });

    it('retries primary provider up to 2 times before success', async () => {
        const expectedResult: SendResult = { messageId: 'AT-5678', provider: 'AfricasTalking', status: 'Success' };
        // Fail twice, succeed on the third attempt (which is retry #2)
        atPrimary.send
            .mockRejectedValueOnce(new Error('Network error'))
            .mockRejectedValueOnce(new Error('Timeout'))
            .mockResolvedValueOnce(expectedResult);

        const result = await service.sendWithFallback('+254700000000', 'Test message');

        expect(result).toEqual(expectedResult);
        expect(atPrimary.send).toHaveBeenCalledTimes(3); // Initial + 2 retries
        expect(twilioSecondary.send).not.toHaveBeenCalled();
    });

    it('falls back to secondary (Twilio) after primary exhausts retries', async () => {
        const fallbackResult: SendResult = { messageId: 'SM1234', provider: 'Twilio', status: 'queued' };
        // Primary fails 3 times (Initial + 2 retries)
        atPrimary.send.mockRejectedValue(new Error('AT Offline'));
        twilioSecondary.send.mockResolvedValue(fallbackResult);

        const result = await service.sendWithFallback('+254700000000', 'Fallback test');

        expect(result).toEqual(fallbackResult);
        expect(atPrimary.send).toHaveBeenCalledTimes(3);
        expect(twilioSecondary.send).toHaveBeenCalledTimes(1);
    });

    it('throws error if both primary and secondary fail entirely', async () => {
        atPrimary.send.mockRejectedValue(new Error('AT Offline'));
        twilioSecondary.send.mockRejectedValue(new Error('Twilio Offline'));

        await expect(service.sendWithFallback('+254700000000', 'Complete failure'))
            .rejects.toThrow('SMS delivery failed completely');

        expect(atPrimary.send).toHaveBeenCalledTimes(3);
        expect(twilioSecondary.send).toHaveBeenCalledTimes(1);
    });
});
