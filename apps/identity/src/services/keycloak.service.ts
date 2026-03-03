/**
 * keycloak.service.ts
 *
 * Thin client around the Keycloak Admin REST API and the token endpoint.
 * All HTTP is done with the built-in `fetch` (Node.js 18+).
 */
import type { UserRole } from '../schemas/auth.schema.js';
import type { TokenResponse } from '../schemas/auth.schema.js';

export interface KeycloakUserPayload {
    email: string;
    name: string;
    password: string;
    role: UserRole;
}

export class KeycloakService {
    private readonly adminBase: string;
    private readonly tokenBase: string;

    constructor(
        private readonly baseUrl: string,
        private readonly realm: string,
        private readonly clientId: string,
        private readonly clientSecret: string,
        private readonly adminUser: string,
        private readonly adminPassword: string,
        private readonly adminClientId: string = 'admin-cli',
    ) {
        this.adminBase = `${baseUrl}/admin/realms/${realm}`;
        this.tokenBase = `${baseUrl}/realms/${realm}/protocol/openid-connect/token`;
    }

    // ── Admin helpers ──────────────────────────────────────────────────────

    /** Obtain a short-lived admin access token via Resource Owner Password grant. */
    private async getAdminToken(): Promise<string> {
        const res = await fetch(
            `${this.baseUrl}/realms/master/protocol/openid-connect/token`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'password',
                    client_id: this.adminClientId,
                    username: this.adminUser,
                    password: this.adminPassword,
                }).toString(),
            },
        );

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Keycloak admin token failed (${res.status}): ${text}`);
        }

        const data = (await res.json()) as { access_token: string };
        return data.access_token;
    }

    /**
     * Create a user in Keycloak.
     * Returns the Keycloak user ID extracted from the Location header.
     */
    async createUser(payload: KeycloakUserPayload): Promise<string> {
        const token = await this.getAdminToken();

        const [firstName, ...rest] = payload.name.trim().split(' ');
        const lastName = rest.join(' ') || ' ';

        const res = await fetch(`${this.adminBase}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                username: payload.email,
                email: payload.email,
                firstName,
                lastName,
                enabled: true,
                emailVerified: false,
                credentials: [
                    {
                        type: 'password',
                        value: payload.password,
                        temporary: false,
                    },
                ],
                realmRoles: [payload.role.toLowerCase()],
            }),
        });

        if (res.status === 409) {
            throw new Error('Email already registered');
        }

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Keycloak createUser failed (${res.status}): ${text}`);
        }

        // Keycloak returns 201 with `Location: .../users/<uuid>`
        const location = res.headers.get('Location') ?? '';
        const keycloakId = location.split('/').pop();
        if (!keycloakId) throw new Error('Keycloak did not return a user ID');
        return keycloakId;
    }

    /** Delete a Keycloak user by ID — used for saga compensating transaction. */
    async deleteUser(keycloakId: string): Promise<void> {
        const token = await this.getAdminToken();
        await fetch(`${this.adminBase}/users/${keycloakId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        // Best-effort; log but don't throw if delete fails
    }

    // ── Token endpoint ─────────────────────────────────────────────────────

    /**
     * Exchange resource-owner credentials for access + refresh tokens.
     * The token TTLs are controlled in the Keycloak realm settings and
     * are configured to 15 min (access) / 7 days (refresh).
     */
    async getToken(email: string, password: string): Promise<TokenResponse> {
        const res = await fetch(this.tokenBase, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'password',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                username: email,
                password,
                scope: 'openid profile email roles',
            }).toString(),
        });

        if (res.status === 401) {
            throw new Error('Invalid credentials');
        }

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Keycloak token exchange failed (${res.status}): ${text}`);
        }

        const data = (await res.json()) as TokenResponse;
        return data;
    }
}
