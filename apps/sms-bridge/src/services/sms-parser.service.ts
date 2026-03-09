import { fuzzy } from 'fast-fuzzy';

export interface ParsedSmsCommand {
    type: 'LOG_SYMPTOM' | 'STATUS' | 'UNKNOWN';
    symptom?: string;
    severity?: string;
    raw: string;
}

const VALID_SYMPTOMS = [
    'BLEEDING',
    'FEVER',
    'HEADACHE',
    'SWELLING',
    'VISION',
    'CONTRACTIONS',
    'FATIGUE',
    'NAUSEA',
    'VOMITING',
    'DIZZINESS'
];

export class SmsParserService {
    /**
     * Parse an inbound SMS string into an actionable structured command
     * e.g. "LOG BLEEDING SEVERE" or "STATUS"
     */
    static parseIncomingSms(text: string): ParsedSmsCommand {
        const cleanText = text.trim().toUpperCase();

        if (cleanText === 'STATUS') {
            return { type: 'STATUS', raw: text };
        }

        if (cleanText.startsWith('LOG')) {
            // Strip out "LOG" and split the remainder
            const remainder = cleanText.substring(3).trim();
            const parts = remainder.split(/\s+/);

            if (parts.length >= 1) {
                const rawSymptomInput = parts[0];
                const rawSeverityInput = parts.length > 1 ? parts[1] : undefined;

                // Fuzzy match symptom against the known dictionary
                let matchedSymptom = rawSymptomInput;
                let bestScore = 0;

                for (const sym of VALID_SYMPTOMS) {
                    const score = fuzzy(rawSymptomInput, sym);
                    if (score > bestScore) {
                        bestScore = score;
                        matchedSymptom = sym;
                    }
                }

                // Threshold of 0.7 for a confident match
                if (bestScore < 0.7) {
                    matchedSymptom = rawSymptomInput;
                }

                return {
                    type: 'LOG_SYMPTOM',
                    symptom: matchedSymptom,
                    severity: rawSeverityInput,
                    raw: text
                };
            }
        }

        return { type: 'UNKNOWN', raw: text };
    }
}
