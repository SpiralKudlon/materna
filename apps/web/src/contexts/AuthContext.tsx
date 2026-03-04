import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
    getToken,
    setTokens,
    clearTokens,
    decodeJwt,
    loginApi,
    type LoginResponse,
} from '../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuthUser {
    sub: string;
    email: string;
    name: string;
    preferred_username: string;
    roles: string[];
    /** True if user still needs to set up TOTP */
    requiresMfa: boolean;
}

interface AuthState {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<AuthUser>;
    logout: () => void;
    clearError: () => void;
}

// ── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthState | undefined>(undefined);

function parseUser(token: string): AuthUser {
    const payload = decodeJwt(token);
    const realmAccess = payload.realm_access as { roles?: string[] } | undefined;
    const roles = realmAccess?.roles ?? [];

    // Determine if MFA setup is required:
    // Keycloak sets `acr` claim or an "otp" execution in the tokenʼs context.
    // For PROVIDER/ADMIN without TOTP configured, the token will NOT contain
    // the "otp" authentication method — we detect this.
    const amr = (payload.amr ?? []) as string[];
    const needsMfa =
        (roles.some((r) => ['provider', 'admin'].includes(r.toLowerCase()))) &&
        !amr.includes('otp');

    return {
        sub: payload.sub as string,
        email: (payload.email ?? '') as string,
        name: (payload.name ?? payload.preferred_username ?? '') as string,
        preferred_username: (payload.preferred_username ?? '') as string,
        roles,
        requiresMfa: needsMfa,
    };
}

// ── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Rehydrate from localStorage on mount
    useEffect(() => {
        const token = getToken();
        if (token) {
            try {
                const decoded = decodeJwt(token);
                const exp = decoded.exp as number;
                if (exp * 1000 > Date.now()) {
                    setUser(parseUser(token));
                } else {
                    clearTokens();
                }
            } catch {
                clearTokens();
            }
        }
        setIsLoading(false);
    }, []);

    const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
        setError(null);
        setIsLoading(true);
        try {
            const res: LoginResponse = await loginApi(email, password);
            const { access_token, refresh_token } = res.data;
            setTokens(access_token, refresh_token);
            const parsed = parseUser(access_token);
            setUser(parsed);
            return parsed;
        } catch (err: unknown) {
            const message = getErrorMessage(err);
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const logout = useCallback(() => {
        clearTokens();
        setUser(null);
        setError(null);
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isLoading,
                error,
                login,
                logout,
                clearError,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAuth(): AuthState {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getErrorMessage(err: unknown): string {
    if (
        typeof err === 'object' &&
        err !== null &&
        'status' in err
    ) {
        const status = (err as { status: number }).status;
        if (status === 401) return 'Invalid email or password.';
        if (status === 403) return 'Your account has been suspended. Contact your administrator.';
        if (status === 429) return 'Too many login attempts. Please try again later.';
    }
    if (err instanceof Error) return err.message;
    return 'An unexpected error occurred. Please try again.';
}
