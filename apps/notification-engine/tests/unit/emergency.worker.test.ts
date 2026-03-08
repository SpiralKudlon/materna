import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Job } from 'bullmq';

const { mockCall } = vi.hoisted(() => {
    return { mockCall: vi.fn().mockResolvedValue({ entries: [] }) };
});

// Mock AfricasTalking
vi.mock('africastalking', () => {
    return {
        default: vi.fn().mockReturnValue({
            VOICE: {
                call: mockCall,
            },
        }),
    };
});



vi.mock('bullmq', () => {
    return {
        Worker: vi.fn().mockImplementation((name, processFn) => {
            return {
                name,
                processFn,
                on: vi.fn(),
            };
        }),
        Queue: vi.fn(),
    };
});

// We don't even need ioredis mock if BullMQ is mocked
vi.mock('ioredis', () => ({ default: vi.fn() }));

vi.mock('../../src/queues/index.js', () => ({
    connection: {},
    notificationsQueue: { add: vi.fn() },
    emergencySosQueue: { add: vi.fn() },
}));

import { emergencySosWorker } from '../../src/workers/emergency.worker.js';
import AfricasTalking from 'africastalking';
import { env } from '../../src/config/env.js';

const mockAT = AfricasTalking({ apiKey: 'mock', username: 'mock' });

describe('EmergencyWorker SLA Validations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        env.AT_VIRTUAL_NUMBER = '+254711223344';
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('processes job and checks SLA (under 2 minutes logs normally)', async () => {
        const consoleSpy = vi.spyOn(console, 'log');
        const errorSpy = vi.spyOn(console, 'error');

        // Job queued exactly now
        const enqueueTime = Date.now();
        const job = {
            id: 'job-sos-1',
            timestamp: enqueueTime,
            data: { patientId: 'p1', patientPhone: 'phone1', chvPhone: '+254700000002' },
        } as unknown as Job;

        // Worker picks it up 1 minute later
        vi.advanceTimersByTime(60_000);

        // Call the processor directly
        const processFn = (emergencySosWorker as any).processFn;
        await processFn(job);

        // Verify Voice API was called
        expect(mockAT.VOICE.call).toHaveBeenCalledWith({
            callFrom: '+254711223344',
            callTo: ['+254700000002'],
        });

        // Ensure no SLA breach was logged
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Queue Latency: 60000ms'));
        expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('SLA BREACH'));
    });

    it('processes job but logs an SLA BREACH if latency > 2 minutes', async () => {
        const consoleSpy = vi.spyOn(console, 'log');
        const errorSpy = vi.spyOn(console, 'error');

        const enqueueTime = Date.now();
        const job = {
            id: 'job-sos-2',
            timestamp: enqueueTime,
            data: { patientId: 'p2', patientPhone: 'phone1', chvPhone: '+254700000002' },
        } as unknown as Job;

        // Worker picks it up 3 minutes later!! (180,000ms)
        vi.advanceTimersByTime(180_000);

        const processFn = (emergencySosWorker as any).processFn;
        await processFn(job);

        expect(mockAT.VOICE.call).toHaveBeenCalled();

        // Ensure SLA breach was logged
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('SLA BREACH: Job job-sos-2 exceeded 2-minute latency (180000ms)')
        );
    });
});
