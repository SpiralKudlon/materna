import { test, expect, describe, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { userRepository } from '../src/repositories/user.repository.js';
import type { FastifyInstance } from 'fastify';

describe('Auth Service', () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        app = buildApp();
        await userRepository.clear();
    });

    test('POST /api/v1/auth/register - success', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User'
            }
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.data).toHaveProperty('id');
        expect(body.data.email).toBe('test@example.com');
        expect(body.data.name).toBe('Test User');
    });

    test('POST /api/v1/auth/register - validation error (short password)', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: 'test@example.com',
                password: 'short',
                name: 'Test User'
            }
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('Validation failed');
    });

    test('POST /api/v1/auth/register - validation error (invalid email)', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: 'not-an-email',
                password: 'password123',
                name: 'Test User'
            }
        });

        expect(response.statusCode).toBe(400);
    });

    test('POST /api/v1/auth/register - conflict (user already exists)', async () => {
        // Create first user
        await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: 'existing@example.com',
                password: 'password123',
                name: 'Existing User'
            }
        });

        // Try to create again
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: 'existing@example.com',
                password: 'password456',
                name: 'Another Name'
            }
        });

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('User already exists');
    });
});
