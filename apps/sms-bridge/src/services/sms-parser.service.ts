import { fuzzy } from 'fast-fuzzy';

export interface ParsedSmsCommand {
    type: 'LOG_SYMPTOM' | 'STATUS' | 'UNKNOWN';
    symptom?: string;
    severity?: string;
    raw: string;
}

/**
 * Canonical map: all recognised keyword strings (English + Swahili) that
 * map to a single standard clinical label.
 *
 * English term → Swahili equivalent used in Kenya pilot:
 *   BLEEDING      → KUTOKA_DAMU (literally: bleeding/discharge)
 *   FEVER         → HOMA
 *   HEADACHE      → KICHWA (kichwa = head pain)
 *   SWELLING      → UVIMBE
 *   VISION        → MAONO (blurred vision)
 *   CONTRACTIONS  → MIKAZO
 *   FATIGUE       → UCHOVU
 *   NAUSEA        → KICHEFUCHEFU
 *   VOMITING      → KUTAPIKA
 *   DIZZINESS     → KIZUNGUZUNGU
 */
export const SYMPTOM_CANONICAL: Record<string, string> = {
    // English
    BLEEDING: 'BLEEDING',
    FEVER: 'FEVER',
    HEADACHE: 'HEADACHE',
    SWELLING: 'SWELLING',
    VISION: 'VISION',
    CONTRACTIONS: 'CONTRACTIONS',
    FATIGUE: 'FATIGUE',
    NAUSEA: 'NAUSEA',
    VOMITING: 'VOMITING',
    DIZZINESS: 'DIZZINESS',
    // Swahili
    KUTOKA_DAMU: 'BLEEDING',
    HOMA: 'FEVER',
    KICHWA: 'HEADACHE',
    UVIMBE: 'SWELLING',
    MAONO: 'VISION',
    MIKAZO: 'CONTRACTIONS',
    UCHOVU: 'FATIGUE',
    KICHEFUCHEFU: 'NAUSEA',
    KUTAPIKA: 'VOMITING',
    KIZUNGUZUNGU: 'DIZZINESS',
};

// All valid input keywords (English + Swahili) the fuzzy matcher operates on
const VALID_SYMPTOMS = Object.keys(SYMPTOM_CANONICAL);

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
                    // Normalize matched keyword (may be Swahili) to canonical English label
                    symptom: SYMPTOM_CANONICAL[matchedSymptom] ?? matchedSymptom,
                    severity: rawSeverityInput,
                    raw: text
                };
            }
        }

        return { type: 'UNKNOWN', raw: text };
    }
}
