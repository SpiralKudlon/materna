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

/**
 * Sprint 7 DoD: Localization
 * "All 10 core symptom logs are successfully translated and tested in Kiswahili."
 *
 * Each test sends a Swahili keyword (exact or with a realistic typo) and verifies
 * that the canonical English label is returned in `result.symptom`.
 */
describe('SmsParserService – Swahili localisation (Sprint 7 DoD)', () => {

    const swahiliCases: Array<{ input: string; expected: string; label: string }> = [
        { input: 'LOG KUTOKA_DAMU SEVERE', expected: 'BLEEDING', label: 'BLEEDING (KUTOKA_DAMU) exact' },
        { input: 'LOG HOMA MODERATE', expected: 'FEVER', label: 'FEVER (HOMA) exact' },
        { input: 'LOG KICHWA MILD', expected: 'HEADACHE', label: 'HEADACHE (KICHWA) exact' },
        { input: 'LOG UVIMBE', expected: 'SWELLING', label: 'SWELLING (UVIMBE) exact' },
        { input: 'LOG MAONO SEVERE', expected: 'VISION', label: 'VISION (MAONO) exact' },
        { input: 'LOG MIKAZO SEVERE', expected: 'CONTRACTIONS', label: 'CONTRACTIONS (MIKAZO) exact' },
        { input: 'LOG UCHOVU MILD', expected: 'FATIGUE', label: 'FATIGUE (UCHOVU) exact' },
        { input: 'LOG KICHEFUCHEFU', expected: 'NAUSEA', label: 'NAUSEA (KICHEFUCHEFU) exact' },
        { input: 'LOG KUTAPIKA SEVERE', expected: 'VOMITING', label: 'VOMITING (KUTAPIKA) exact' },
        { input: 'LOG KIZUNGUZUNGU MILD', expected: 'DIZZINESS', label: 'DIZZINESS (KIZUNGUZUNGU) exact' },
    ];

    for (const { input, expected, label } of swahiliCases) {
        it(`should resolve "${label}" to canonical label "${expected}"`, () => {
            const result = SmsParserService.parseIncomingSms(input);
            expect(result.type).toBe('LOG_SYMPTOM');
            expect(result.symptom).toBe(expected);
        });
    }

    it('should fuzzy-match typo Swahili "HOMAA" → FEVER', () => {
        const result = SmsParserService.parseIncomingSms('LOG HOMAA MODERATE');
        expect(result.type).toBe('LOG_SYMPTOM');
        expect(result.symptom).toBe('FEVER');
    });

    it('should fuzzy-match typo Swahili "KICHEFUCHEF" → NAUSEA', () => {
        const result = SmsParserService.parseIncomingSms('LOG KICHEFUCHEF');
        expect(result.type).toBe('LOG_SYMPTOM');
        expect(result.symptom).toBe('NAUSEA');
    });

    it('should fuzzy-match typo Swahili "KIZUNGZUNGU" → DIZZINESS', () => {
        const result = SmsParserService.parseIncomingSms('LOG KIZUNGZUNGU SEVERE');
        expect(result.type).toBe('LOG_SYMPTOM');
        expect(result.symptom).toBe('DIZZINESS');
    });
});

