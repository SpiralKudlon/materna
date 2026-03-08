import type { ISmsProvider, SendResult } from './sms.strategy.js';
import type { FastifyBaseLogger } from 'fastify';

/**
 * Orchestrates SMS sending with a retry and fallback strategy.
 * 1. Try Primary Provider (Africa's Talking)
 * 2. If it fails, retry up to MAX_RETRIES times.
 * 3. If all retries fail, switch to Secondary Provider (Twilio).
 */
export class SmsBridgeService {
    private primaryProvider: ISmsProvider;
    private secondaryProvider: ISmsProvider;
    private logger: FastifyBaseLogger;

    private readonly MAX_RETRIES = 2;

    constructor(
        primary: ISmsProvider,
        secondary: ISmsProvider,
        logger: FastifyBaseLogger
    ) {
        this.primaryProvider = primary;
        this.secondaryProvider = secondary;
        this.logger = logger;
    }

    /**
     * Sends an SMS using the fallback strategy.
     * @param to Phone number in E.164 format (e.g., +254700000000)
     * @param message Text content of the SMS
     */
    async sendWithFallback(to: string, message: string): Promise<SendResult> {
        let attempts = 0;

        // Try Primary Provider
        while (attempts <= this.MAX_RETRIES) {
            try {
                if (attempts > 0) {
                    this.logger.warn(`Retrying SMS via ${this.primaryProvider.name} (Attempt ${attempts + 1}/${this.MAX_RETRIES + 1})...`);
                }
                const result = await this.primaryProvider.send(to, message);
                this.logger.info(`SMS sent via ${result.provider}. MsgID: ${result.messageId}`);
                return result;
            } catch (error: any) {
                attempts++;
                this.logger.error(`Failed to send via ${this.primaryProvider.name}: ${error.message}`);
            }
        }

        // Fallback to Secondary Provider
        this.logger.warn(`Primary provider exhausted. Falling back to ${this.secondaryProvider.name}.`);
        try {
            const result = await this.secondaryProvider.send(to, message);
            this.logger.info(`SMS sent via fallback (${result.provider}). MsgID: ${result.messageId}`);
            return result;
        } catch (error: any) {
            this.logger.error(`Fallback provider also failed: ${error.message}`);
            throw new Error(`SMS delivery failed completely. Both ${this.primaryProvider.name} and ${this.secondaryProvider.name} failed.`);
        }
    }
}
