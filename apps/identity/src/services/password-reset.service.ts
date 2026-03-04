/**
 * password-reset.service.ts — Orchestrates the forgot/reset password flow.
 *
 * forgot-password:
 *   1. Look up the user by phone in PostgreSQL
 *   2. Generate OTP in Redis (5-min TTL)
 *   3. Send OTP via SMS (Africa's Talking)
 *
 * reset-password:
 *   1. Verify OTP (max 3 attempts)
 *   2. Reset the password in Keycloak via Admin API
 */
import type { Pool } from 'pg';
import type { OtpStore, OtpVerifyResult } from './otp.store.js';
import type { SmsGateway } from './sms.service.js';
import type { KeycloakService } from './keycloak.service.js';

export interface ForgotPasswordInput {
    phone: string;
}

export interface ResetPasswordInput {
    phone: string;
    otp: string;
    new_password: string;
}

export class PasswordResetService {
    constructor(
        private readonly pool: Pool,
        private readonly otpStore: OtpStore,
        private readonly sms: SmsGateway,
        private readonly keycloak: KeycloakService,
    ) { }

    // ── Forgot Password ────────────────────────────────────────────────────

    async forgotPassword(input: ForgotPasswordInput): Promise<{ sent: boolean }> {
        // Look up user by phone (we query the local DB)
        const result = await this.pool.query<{ keycloak_id: string; name: string }>(
            `SELECT keycloak_id, name FROM users
             WHERE phone = $1 LIMIT 1`,
            [input.phone],
        );

        const user = result.rows[0];
        if (!user) {
            // Return success anyway to prevent phone enumeration
            return { sent: true };
        }

        // Generate OTP in Redis
        const otp = await this.otpStore.create(input.phone);

        // Send via SMS
        await this.sms.send(
            input.phone,
            `Your Maternal System verification code is: ${otp}. ` +
            'It expires in 5 minutes. Do not share this code.',
        );

        return { sent: true };
    }

    // ── Reset Password ─────────────────────────────────────────────────────

    async resetPassword(input: ResetPasswordInput): Promise<{
        success: boolean;
        reason?: string;
    }> {
        // Verify OTP
        const verifyResult: OtpVerifyResult = await this.otpStore.verify(
            input.phone,
            input.otp,
        );

        switch (verifyResult) {
            case 'EXPIRED':
                return { success: false, reason: 'OTP expired or not found' };
            case 'INVALID':
                return { success: false, reason: 'Invalid OTP' };
            case 'MAX_ATTEMPTS_EXCEEDED':
                return { success: false, reason: 'Maximum OTP attempts exceeded' };
            case 'VALID':
                break;
        }

        // Look up user's Keycloak ID
        const result = await this.pool.query<{ keycloak_id: string }>(
            'SELECT keycloak_id FROM users WHERE phone = $1 LIMIT 1',
            [input.phone],
        );

        const user = result.rows[0];
        if (!user) {
            return { success: false, reason: 'User not found' };
        }

        // Reset password in Keycloak
        await this.keycloak.resetUserPassword(user.keycloak_id, input.new_password);

        return { success: true };
    }
}
