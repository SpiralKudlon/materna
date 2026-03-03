/**
 * user.repository.ts
 *
 * Real PostgreSQL implementation of the user repository.
 * The users table is expected to exist from the database migration.
 *
 * Schema assumed:
 *   CREATE TABLE users (
 *     id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
 *     email        TEXT        NOT NULL UNIQUE,
 *     name         TEXT        NOT NULL,
 *     role         TEXT        NOT NULL,
 *     keycloak_id  TEXT        NOT NULL UNIQUE,
 *     created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *     updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 */
import type { Pool, PoolClient } from 'pg';

export interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    keycloak_id: string;
    created_at: Date;
    updated_at: Date;
}

export interface CreateUserInput {
    email: string;
    name: string;
    role: string;
    keycloak_id: string;
}

export class UserRepository {
    constructor(private readonly pool: Pool) { }

    async findByEmail(email: string, client?: PoolClient): Promise<User | undefined> {
        const db = client ?? this.pool;
        const result = await db.query<User>(
            'SELECT * FROM users WHERE email = $1 LIMIT 1',
            [email],
        );
        return result.rows[0];
    }

    async findById(id: string, client?: PoolClient): Promise<User | undefined> {
        const db = client ?? this.pool;
        const result = await db.query<User>(
            'SELECT * FROM users WHERE id = $1 LIMIT 1',
            [id],
        );
        return result.rows[0];
    }

    async create(input: CreateUserInput, client?: PoolClient): Promise<User> {
        const db = client ?? this.pool;
        const result = await db.query<User>(
            `INSERT INTO users (email, name, role, keycloak_id)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [input.email, input.name, input.role, input.keycloak_id],
        );
        const user = result.rows[0];
        if (!user) throw new Error('INSERT returned no rows');
        return user;
    }
}
