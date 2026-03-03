/**
 * auth.service.ts
 *
 * Orchestrates user registration across two external systems:
 *   1. Keycloak (source of truth for authentication)
 *   2. PostgreSQL users table (local profile + role store)
 *
 * Registration uses the Saga pattern with a compensating transaction:
 *   Step 1 – create user in Keycloak
 *   Step 2 – insert user into PostgreSQL (inside a DB transaction)
 *   If Step 2 fails → call KeycloakService.deleteUser (compensation)
 *
 * Login delegates entirely to Keycloak's token endpoint.
 */
import type { Pool } from 'pg';
import { UserRepository } from '../repositories/user.repository.js';
import { KeycloakService } from './keycloak.service.js';
import type { RegisterInput, LoginInput, TokenResponse } from '../schemas/auth.schema.js';

export interface RegisterResult {
    id: string;
    email: string;
    name: string;
    role: string;
    keycloak_id: string;
}

export class AuthService {
    private readonly userRepo: UserRepository;

    constructor(
        private readonly pool: Pool,
        private readonly keycloak: KeycloakService,
    ) {
        this.userRepo = new UserRepository(pool);
    }

    // ── Register ───────────────────────────────────────────────────────────

    async register(input: RegisterInput): Promise<RegisterResult> {
        // Pre-flight: check local DB first to avoid unnecessary Keycloak calls
        const existingUser = await this.userRepo.findByEmail(input.email);
        if (existingUser) {
            throw new ConflictError('Email already registered');
        }

        // ── Step 1: Create user in Keycloak ────────────────────────────────
        let keycloakId: string;
        try {
            keycloakId = await this.keycloak.createUser({
                email: input.email,
                name: input.name,
                password: input.password,
                role: input.role,
            });
        } catch (err) {
            if (err instanceof Error && err.message === 'Email already registered') {
                throw new ConflictError('Email already registered');
            }
            throw err;
        }

        // ── Step 2: Insert into PostgreSQL (inside a transaction) ──────────
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const user = await this.userRepo.create(
                {
                    email: input.email,
                    name: input.name,
                    role: input.role,
                    keycloak_id: keycloakId,
                },
                client,
            );

            await client.query('COMMIT');

            return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                keycloak_id: user.keycloak_id,
            };
        } catch (dbErr) {
            await client.query('ROLLBACK');

            // ── Compensating transaction: remove user from Keycloak ─────────
            try {
                await this.keycloak.deleteUser(keycloakId);
            } catch (cleanupErr) {
                // Log but don't mask the original error; ops team must reconcile manually
                console.error(
                    `[SAGA] Failed to delete Keycloak user ${keycloakId} after DB error. ` +
                    'Manual cleanup required.',
                    cleanupErr,
                );
            }

            throw dbErr;
        } finally {
            client.release();
        }
    }

    // ── Login ──────────────────────────────────────────────────────────────

    async login(input: LoginInput): Promise<TokenResponse> {
        try {
            return await this.keycloak.getToken(input.email, input.password);
        } catch (err) {
            if (err instanceof Error && err.message === 'Invalid credentials') {
                throw new UnauthorizedError('Invalid email or password');
            }
            throw err;
        }
    }
}

// ── Domain error types ─────────────────────────────────────────────────────
export class ConflictError extends Error {
    readonly statusCode = 409;
    constructor(message: string) { super(message); this.name = 'ConflictError'; }
}

export class UnauthorizedError extends Error {
    readonly statusCode = 401;
    constructor(message: string) { super(message); this.name = 'UnauthorizedError'; }
}
