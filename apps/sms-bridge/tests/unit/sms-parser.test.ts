import { describe, it, expect } from 'vitest';
import { SmsParserService } from '../../src/services/sms-parser.service.js';

describe('SmsParserService', () => {

    it('should parse STATUS correctly regardless of case/whitespace', () => {
        const res1 = SmsParserService.parseIncomingSms('STATUS');
        expect(res1.type).toBe('STATUS');

        const res2 = SmsParserService.parseIncomingSms('   sTaTus  ');
        expect(res2.type).toBe('STATUS');
    });

    it('should correctly extract exact match LOG SYMPTOM commands', () => {
        const result = SmsParserService.parseIncomingSms('LOG BLEEDING SEVERE');
        expect(result.type).toBe('LOG_SYMPTOM');
        expect(result.symptom).toBe('BLEEDING');
        expect(result.severity).toBe('SEVERE');
    });

    it('should handle LOG without a severity', () => {
        const result = SmsParserService.parseIncomingSms('log fever');
        expect(result.type).toBe('LOG_SYMPTOM');
        expect(result.symptom).toBe('FEVER');
        expect(result.severity).toBeUndefined();
    });

    it('should fuzzy match misspelled symptoms', () => {
        // "HEDACHE" -> "HEADACHE"
        const result1 = SmsParserService.parseIncomingSms('LOG HEDACHE MODERATE');
        expect(result1.type).toBe('LOG_SYMPTOM');
        expect(result1.symptom).toBe('HEADACHE');

        // "SWELING" -> "SWELLING"
        const result2 = SmsParserService.parseIncomingSms('LOG SWELING');
        expect(result2.type).toBe('LOG_SYMPTOM');
        expect(result2.symptom).toBe('SWELLING');
    });

    it('should return UNKNOWN for unrecognized command strings', () => {
        const result1 = SmsParserService.parseIncomingSms('HELLO WORLD');
        expect(result1.type).toBe('UNKNOWN');

        const result2 = SmsParserService.parseIncomingSms('I AM HAVING PAIN');
        expect(result2.type).toBe('UNKNOWN');
    });
});
