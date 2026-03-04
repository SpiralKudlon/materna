/**
 * api.ts — Centralized API client with automatic Bearer token injection.
 *
 * Uses native fetch wrapped in a thin helper. The token is read from
 * localStorage on every request, so the user is automatically
 * authenticated after login without prop-drilling.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

const TOKEN_KEY = 'ms_access_token';
const REFRESH_KEY = 'ms_refresh_token';

// ── Token helpers ──────────────────────────────────────────────────────────

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string): void {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
}

/** Decode a JWT payload (no verification — client-side only). */
export function decodeJwt(token: string): Record<string, unknown> {
    const base64 = token.split('.')[1] ?? '';
    return JSON.parse(atob(base64.replace(/-/g, '+').replace(/_/g, '/')));
}

// ── Error class ────────────────────────────────────────────────────────────

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly body: unknown,
    ) {
        super(`API ${status}`);
        this.name = 'ApiError';
    }
}

// ── Fetch wrapper ──────────────────────────────────────────────────────────

export async function api<T = unknown>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new ApiError(res.status, body);
    }

    return res.json() as Promise<T>;
}

// ── Auth-specific API calls ────────────────────────────────────────────────

export interface LoginResponse {
    data: {
        access_token: string;
        refresh_token: string;
        token_type: string;
        expires_in: number;
        refresh_expires_in: number;
    };
}

export async function loginApi(
    email: string,
    password: string,
): Promise<LoginResponse> {
    return api<LoginResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
}

export async function loginWithPhoneApi(
    phone: string,
    password: string,
): Promise<LoginResponse> {
    // Backend could accept phone in the email field or have a separate endpoint
    return api<LoginResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: phone, password }),
    });
}
