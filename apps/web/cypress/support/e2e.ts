// Cypress support file — runs before each spec

// Add custom commands
declare global {
    namespace Cypress {
        interface Chainable {
            /** Stub the login API to return a valid JWT */
            mockLoginSuccess(role?: string): void;
            /** Stub the login API to return 401 */
            mockLoginFailure(): void;
        }
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a fake JWT token that decodeJwt() can parse on the client side.
 * NOT cryptographically valid — only used for client routing tests.
 */
function fakeJwt(payload: Record<string, unknown>): string {
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const body = btoa(JSON.stringify(payload));
    const sig = btoa('fake-signature');
    return `${header}.${body}.${sig}`;
}

Cypress.Commands.add('mockLoginSuccess', (role = 'patient') => {
    const token = fakeJwt({
        sub: 'test-user-uuid',
        email: 'test@example.com',
        name: 'Test User',
        preferred_username: 'test',
        realm_access: { roles: [role] },
        amr: role === 'admin' || role === 'provider' ? [] : ['pwd'],
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'https://auth.example.com/realms/maternal-system',
        aud: 'api-server',
    });

    cy.intercept('POST', '**/api/v1/auth/login', {
        statusCode: 200,
        body: {
            data: {
                access_token: token,
                refresh_token: 'fake-refresh-token',
                token_type: 'Bearer',
                expires_in: 900,
                refresh_expires_in: 604800,
            },
        },
    }).as('loginRequest');
});

Cypress.Commands.add('mockLoginFailure', () => {
    cy.intercept('POST', '**/api/v1/auth/login', {
        statusCode: 401,
        body: { error: 'Invalid credentials' },
    }).as('loginRequest');
});

export { };
