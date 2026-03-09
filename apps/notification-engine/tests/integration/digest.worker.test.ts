import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const { mockQuery, mockSmsSend } = vi.hoisted(() => {
    return {
        mockQuery: vi.fn(),
        mockSmsSend: vi.fn().mockResolvedValue({ entries: [] })
    };
});

vi.mock('pg', () => {
    const Pool = vi.fn(() => ({ query: mockQuery }));
    return { default: { Pool }, Pool };
});

vi.mock('africastalking', () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            SMS: { send: (...args: any[]) => mockSmsSend(...args) },
        })),
    };
});

// Import worker after hoisted mocks
import { digestWorker } from '../../src/workers/digest.worker.js';

// Mock template engine bypassing DB
vi.mock('../../src/services/template.service.js', () => {
    return {
        TemplateService: vi.fn().mockImplementation(() => ({
            render: vi.fn().mockImplementation(async (name, lang, vars) => {
                if (lang === 'sw') {
                    return `Habari ${vars.chvName}, una wagonjwa ${vars.highRiskCount} (Jumla: ${vars.totalCount})`;
                }
                return `Hello ${vars.chvName}, you have ${vars.highRiskCount} out of ${vars.totalCount} HIGH risk patients`;
            })
        }))
    };
});

describe('Daily Digest Worker', () => {
    beforeAll(() => {
        // Prevent actual processing inside Vitest env
        digestWorker.pause();
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    it('should aggregate high risk patients and dispatch localized SMS correctly', async () => {
        // 1. Mock DB returns CHVs list
        mockQuery.mockResolvedValueOnce({
            rows: [
                { id: 'chv-1', name: 'John Doe', phone: '+123', preferred_language: 'en' },
                { id: 'chv-2', name: 'Jane Doe', phone: '+456', preferred_language: 'sw' }
            ]
        });

        // 2. Mock DB returns Risk Assignments
        // chv-1 has 2 high risk out of 5
        // chv-2 has 0 high risk out of 10
        // chv-3 has 1 high risk (but not explicitly populated above representing resilient joins)
        mockQuery.mockResolvedValueOnce({
            rows: [
                { chv_id: 'chv-1', total_patients: '5', high_risk: '2' },
                { chv_id: 'chv-2', total_patients: '10', high_risk: '0' },
                { chv_id: 'chv-3', total_patients: '7', high_risk: '1' }
            ]
        });

        // 3. Mock DB Individual Profile fetches inside the loop loop (only hit for chv-1 and chv-3)
        mockQuery.mockResolvedValueOnce({ rows: [{ preferred_language: 'en', phone_enc: Buffer.from('') }] }); // chv-1
        mockQuery.mockResolvedValueOnce({ rows: [{ preferred_language: 'sw', phone_enc: Buffer.from('') }] }); // chv-3

        const processFn = (digestWorker as any).processFn;

        // Execute manually
        await processFn({ id: 'test-digest' });

        // Verify CHV 2 was safely ignored since they had 0 high risks
        expect(mockSmsSend).toHaveBeenCalledTimes(2);

        // Verify interpolation rendered correctly for CHV-1 (English)
        expect(mockSmsSend).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Hello CHV, you have 2 out of 5 HIGH risk patients',
        }));

        // Verify interpolation rendered correctly for CHV-3 (Swahili fallback logic)
        expect(mockSmsSend).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Habari CHV, una wagonjwa 1 (Jumla: 7)',
        }));
    });
});
