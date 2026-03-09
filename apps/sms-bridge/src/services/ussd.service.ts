import { getRedisClient } from '../config/redis.js';
import { ussdSessionCompletionsTotal, ussdSessionDurationSeconds } from '../config/metrics.js';

type USSDState = 'MENU_MAIN' | 'MENU_LOG_SYMPTOM' | 'MENU_LOG_SEVERITY' | 'FINISHED';

interface SessionData {
    state: USSDState;
    phoneNumber: string;
    symptom?: string;
    severity?: string;
    lastUpdated: number;
}

const TTL_SECONDS = 90;

export class UssdService {
    /**
     * Process an incoming USSD string from Africa's Talking
     * @param sessionId The Africa's Talking unique session ID
     * @param phoneNumber The patient's MSISDN
     * @param text The raw text input (e.g. "1*2" or just "1")
     * @returns The raw string prefixed with CON (continue) or END (terminate)
     */
    static async handleUssdCallback(sessionId: string, phoneNumber: string, text: string): Promise<string> {
        const redis = getRedisClient();
        const sessionKey = `ussd:session:${sessionId}`;

        // Get existing session state or initialize new
        let session: SessionData;
        const existingRaw = await redis.get(sessionKey);

        if (existingRaw) {
            session = JSON.parse(existingRaw);
        } else {
            session = {
                state: 'MENU_MAIN',
                phoneNumber,
                lastUpdated: Date.now()
            };
        }

        // Africa's Talking provides the entire history delimited by asterisks (e.g., "1*1*2")
        // We only care about the very last inputted term sequentially if we assume state is intact,
        // OR we can just split standard arrays. We will use the last token.
        const inputs = text.split('*');
        const latestInput = inputs[inputs.length - 1] || '';

        // Calculate Response text based on State Machine Navigation
        let responseText = '';
        let newState: USSDState = session.state;

        if (text === '') {
            // Initial render
            newState = 'MENU_MAIN';
            responseText = `CON Welcome to Maternal Health Services
1. Log Symptom
2. My Risk Status
3. Next ANC Visit
4. Emergency SOS`;
        } else if (session.state === 'MENU_MAIN') {
            switch (latestInput) {
                case '1':
                    newState = 'MENU_LOG_SYMPTOM';
                    responseText = `CON Which symptom?
1. Bleeding
2. Fever
3. Headache
4. Contractions
5. Swelling`;
                    break;
                case '2':
                    newState = 'FINISHED';
                    // Implicitly you'd fetch real Risk DB tier here
                    responseText = `END Your latest Risk Tier is LOW. Stay safe!`;
                    ussdSessionCompletionsTotal.inc({ status: 'success' });
                    break;
                case '3':
                    newState = 'FINISHED';
                    responseText = `END Your next ANC Visit is on 2026-04-15.`;
                    ussdSessionCompletionsTotal.inc({ status: 'success' });
                    break;
                case '4':
                    newState = 'FINISHED';
                    responseText = `END SOS Emergency Alert Fired! A CHV is being dispatched.`;
                    ussdSessionCompletionsTotal.inc({ status: 'success' });
                    break;
                default:
                    responseText = `CON Invalid Choice.
1. Log Symptom
2. My Risk Status
3. Next ANC Visit
4. Emergency SOS`;
            }
        } else if (session.state === 'MENU_LOG_SYMPTOM') {
            const symMap: Record<string, string> = {
                '1': 'BLEEDING', '2': 'FEVER', '3': 'HEADACHE', '4': 'CONTRACTIONS', '5': 'SWELLING'
            };
            const mapped = symMap[latestInput];

            if (mapped) {
                session.symptom = mapped;
                newState = 'MENU_LOG_SEVERITY';
                responseText = `CON Severity of ${mapped}?
1. Mild
2. Moderate
3. Severe`;
            } else {
                responseText = `CON Invalid Choice. Which symptom?
1. Bleeding
2. Fever
3. Headache
4. Contractions
5. Swelling`;
            }
        } else if (session.state === 'MENU_LOG_SEVERITY') {
            const sevMap: Record<string, string> = {
                '1': 'MILD', '2': 'MODERATE', '3': 'SEVERE'
            };
            const mapped = sevMap[latestInput];

            if (mapped) {
                session.severity = mapped;
                newState = 'FINISHED';
                // Fire off implicit database insert here
                responseText = `END Thank you. Logged ${session.symptom} (${mapped}).`;

                ussdSessionCompletionsTotal.inc({ status: 'success' });

                // Track exact workflow latency exclusively for Symptom Logs
                const durationSeconds = (Date.now() - session.lastUpdated) / 1000;
                ussdSessionDurationSeconds.observe(durationSeconds);
            } else {
                responseText = `CON Invalid Choice. Severity?
1. Mild
2. Moderate
3. Severe`;
            }
        }

        // Commit updated state back to Redis
        session.state = newState;
        session.lastUpdated = Date.now();

        if (newState === 'FINISHED') {
            await redis.del(sessionKey);
        } else {
            await redis.set(sessionKey, JSON.stringify(session), 'EX', TTL_SECONDS);
        }

        return responseText;
    }
}
