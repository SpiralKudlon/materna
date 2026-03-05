/**
 * Toast — minimal toast notification component.
 *
 * Renders toast messages at the bottom-right of the viewport.
 * Auto-dismisses after the configured duration.
 */
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import type { ReactNode } from 'react';

// ── Types ──────────────────────────────────────────────────────────────

export type ToastVariant = 'default' | 'success' | 'error' | 'warning';

export interface ToastMessage {
    id: string;
    title: string;
    description?: string;
    variant: ToastVariant;
    duration: number; // ms
}

interface ToastContextValue {
    toast: (opts: Omit<ToastMessage, 'id'>) => void;
}

// ── Context ────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be inside ToastProvider');
    return ctx;
}

// ── Provider + Renderer ────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = useCallback((opts: Omit<ToastMessage, 'id'>) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        setToasts(prev => [...prev, { ...opts, id }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toast: addToast }}>
            {children}
            {/* Portal-style overlay */}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
                {toasts.map(t => (
                    <ToastItem key={t.id} toast={t} onDismiss={removeToast} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

// ── Individual Toast ───────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, string> = {
    default: 'bg-background border-border text-foreground',
    success: 'bg-green-50 border-green-300 text-green-900 dark:bg-green-950 dark:border-green-700 dark:text-green-100',
    error: 'bg-red-50 border-red-300 text-red-900 dark:bg-red-950 dark:border-red-700 dark:text-red-100',
    warning: 'bg-yellow-50 border-yellow-300 text-yellow-900 dark:bg-yellow-950 dark:border-yellow-700 dark:text-yellow-100',
};

const VARIANT_ICONS: Record<ToastVariant, string> = {
    default: 'ℹ️',
    success: '✓',
    error: '✕',
    warning: '⚠',
};

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Animate in
        requestAnimationFrame(() => setIsVisible(true));

        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => onDismiss(toast.id), 300); // Wait for exit animation
        }, toast.duration);

        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onDismiss]);

    return (
        <div
            className={`
                pointer-events-auto border rounded-lg px-4 py-3 shadow-lg
                transition-all duration-300 ease-in-out
                ${VARIANT_STYLES[toast.variant]}
                ${isVisible
                    ? 'translate-x-0 opacity-100'
                    : 'translate-x-full opacity-0'
                }
            `}
        >
            <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0 mt-0.5">
                    {VARIANT_ICONS[toast.variant]}
                </span>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{toast.title}</p>
                    {toast.description && (
                        <p className="text-xs mt-0.5 opacity-80">{toast.description}</p>
                    )}
                </div>
                <button
                    onClick={() => {
                        setIsVisible(false);
                        setTimeout(() => onDismiss(toast.id), 300);
                    }}
                    className="text-xs opacity-50 hover:opacity-100 flex-shrink-0"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
