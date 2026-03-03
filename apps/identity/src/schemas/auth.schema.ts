import { z } from 'zod';

// ─── Role enum (shared with Keycloak realm roles) ───────────────────────────
export const UserRole = z.enum(['PATIENT', 'CHV', 'PROVIDER', 'ADMIN']);
export type UserRole = z.infer<typeof UserRole>;

// ─── Register ────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
    email: z.string().email({ message: 'A valid email address is required' }),
    password: z
        .string()
        .min(8, { message: 'Password must be at least 8 characters' })
        .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
        .regex(/[0-9]/, { message: 'Password must contain at least one number' }),
    name: z.string().min(2, { message: 'Full name must be at least 2 characters' }),
    role: UserRole,
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ─── Login ───────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1, { message: 'Password is required' }),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ─── Token response ──────────────────────────────────────────────────────────
export const tokenResponseSchema = z.object({
    access_token: z.string(),
    refresh_token: z.string(),
    token_type: z.string(),
    expires_in: z.number(),
    refresh_expires_in: z.number(),
});

export type TokenResponse = z.infer<typeof tokenResponseSchema>;
