describe('Login Flow', () => {
    beforeEach(() => {
        // Clear any stored tokens
        cy.clearLocalStorage();
    });

    // ── Successful login ──────────────────────────────────────────────────
    it('logs in successfully with valid credentials and redirects to dashboard', () => {
        cy.mockLoginSuccess('patient');
        cy.visit('/login');

        // Verify login page elements
        cy.contains('Welcome back').should('be.visible');
        cy.get('#identifier').should('be.visible');
        cy.get('#password').should('be.visible');

        // Fill in the form
        cy.get('#identifier').type('test@example.com');
        cy.get('#password').type('Password123');
        cy.get('#login-submit').click();

        // Wait for API call
        cy.wait('@loginRequest').then((interception) => {
            expect(interception.request.body).to.deep.include({
                email: 'test@example.com',
                password: 'Password123',
            });
        });

        // Should redirect to the main app (registration form page)
        cy.url().should('not.include', '/login');
        cy.contains('Patient Registration').should('be.visible');
    });

    // ── Failed login with incorrect password ──────────────────────────────
    it('shows error message on failed login (incorrect password)', () => {
        cy.mockLoginFailure();
        cy.visit('/login');

        // Fill in credentials
        cy.get('#identifier').type('test@example.com');
        cy.get('#password').type('WrongPassword123');
        cy.get('#login-submit').click();

        // Wait for API call
        cy.wait('@loginRequest');

        // Error banner should appear
        cy.get('#login-error')
            .should('be.visible')
            .and('contain.text', 'Invalid email or password');

        // Should remain on login page
        cy.url().should('include', '/login');
    });

    // ── Validation errors ─────────────────────────────────────────────────
    it('shows validation error when fields are empty', () => {
        cy.visit('/login');
        cy.get('#login-submit').click();

        // Should show validation messages
        cy.contains('Email or phone number is required').should('be.visible');
        cy.contains('Password is required').should('be.visible');
    });

    // ── Email/phone toggle ────────────────────────────────────────────────
    it('toggles between email and phone login modes', () => {
        cy.visit('/login');

        // Default: email mode
        cy.get('#identifier').should('have.attr', 'type', 'email');
        cy.contains('Use phone number instead').should('be.visible');

        // Toggle to phone
        cy.contains('Use phone number instead').click();
        cy.get('#identifier').should('have.attr', 'type', 'tel');
        cy.contains('Use email instead').should('be.visible');

        // Toggle back
        cy.contains('Use email instead').click();
        cy.get('#identifier').should('have.attr', 'type', 'email');
    });

    // ── Password visibility toggle ────────────────────────────────────────
    it('toggles password visibility', () => {
        cy.visit('/login');

        cy.get('#password').should('have.attr', 'type', 'password');

        // Click the eye icon
        cy.get('button[aria-label="Show password"]').click();
        cy.get('#password').should('have.attr', 'type', 'text');

        cy.get('button[aria-label="Hide password"]').click();
        cy.get('#password').should('have.attr', 'type', 'password');
    });

    // ── Auth guard redirect ───────────────────────────────────────────────
    it('redirects unauthenticated users to /login', () => {
        cy.visit('/');
        cy.url().should('include', '/login');
    });

    // ── MFA prompt for PROVIDER/ADMIN ─────────────────────────────────────
    it('shows MFA setup for ADMIN users on first login', () => {
        cy.mockLoginSuccess('admin');
        cy.visit('/login');

        cy.get('#identifier').type('admin@example.com');
        cy.get('#password').type('AdminPass1');
        cy.get('#login-submit').click();

        cy.wait('@loginRequest');

        // MFA setup screen should appear
        cy.contains('Two-Factor Authentication Required').should('be.visible');
        cy.contains('Begin Setup').should('be.visible');
    });
});
