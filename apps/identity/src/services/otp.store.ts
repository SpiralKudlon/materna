/**
 * otp.store.ts — Redis-backed OTP store with attempt tracking.
 *
 * For each phone number, stores:
 *   Key: otp:<phone>         → the 6-digit OTP (TTL 5 min)
 *   Key: otp:attempts:<phone> → attempt counter (TTL 5 min, max 3)
 *
 * After 3 failed attempts the OTP is invalidated and subsequent
 * calls return 'MAX_ATTEMPTS_EXCEEDED'.
 */
import type Redis from 'ioredis';

export type OtpVerifyResult = 'VALID' | 'INVALID' | 'EXPIRED' | 'MAX_ATTEMPTS_EXCEEDED';

const OTP_TTL_SECONDS = 300;  // 5 minutes
const MAX_ATTEMPTS = 3;

export class OtpStore {
    constructor(private readonly redis: Redis) { }

    /** Generate and store a random 6-digit OTP. Returns the OTP string. */
    async create(phone: string): Promise<string> {
        const otp = String(Math.floor(100000 + Math.random() * 900000));

        const pipeline = this.redis.pipeline();
        pipeline.set(`otp:${phone}`, otp, 'EX', OTP_TTL_SECONDS);
        pipeline.set(`otp:attempts:${phone}`, '0', 'EX', OTP_TTL_SECONDS);
        await pipeline.exec();

        return otp;
    }

    /**
     * Verify an OTP.
     *
     * Returns:
     *  - VALID               → OTP matches; both keys are deleted
     *  - INVALID             → OTP does not match; attempt counter incremented
     *  - EXPIRED             → OTP key does not exist (TTL expired or never created)
     *  - MAX_ATTEMPTS_EXCEEDED → 3rd failed attempt reached; OTP is deleted
     */
    async verify(phone: string, code: string): Promise<OtpVerifyResult> {
        const stored = await this.redis.get(`otp:${phone}`);
        if (!stored) return 'EXPIRED';

        // Check attempt count BEFORE comparing
        const attempts = parseInt(await this.redis.get(`otp:attempts:${phone}`) ?? '0', 10);
        if (attempts >= MAX_ATTEMPTS) {
            // Invalidate the OTP entirely
            await this.redis.del(`otp:${phone}`, `otp:attempts:${phone}`);
            return 'MAX_ATTEMPTS_EXCEEDED';
        }

        if (stored !== code) {
            const newAttempts = await this.redis.incr(`otp:attempts:${phone}`);
            // If this increment brings us to the limit, delete the OTP
            if (newAttempts >= MAX_ATTEMPTS) {
                await this.redis.del(`otp:${phone}`, `otp:attempts:${phone}`);
                return 'MAX_ATTEMPTS_EXCEEDED';
            }
            return 'INVALID';
        }

        // Match — clean up
        await this.redis.del(`otp:${phone}`, `otp:attempts:${phone}`);
        return 'VALID';
    }

    /** Delete an OTP (used for cleanup in tests). */
    async delete(phone: string): Promise<void> {
        await this.redis.del(`otp:${phone}`, `otp:attempts:${phone}`);
    }
}
