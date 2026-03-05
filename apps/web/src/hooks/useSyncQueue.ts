/**
 * useSyncQueue — React hook for offline sync with toast notifications.
 *
 * Responsibilities:
 *   1. Track online/offline status
 *   2. When a POST to /anc-visits is submitted offline, enqueue it in Dexie
 *   3. When network returns, replay queued requests
 *   4. Fire toast notifications for sync success/failure
 *   5. Listen for Service Worker SYNC_SUCCESS messages
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { enqueueRequest, replayPendingRequests, getPendingCount } from '../db/syncQueue';
import { useToast } from '../components/Toast';

export function useSyncQueue() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [syncing, setSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const syncLock = useRef(false);
    const { toast } = useToast();

    // Refresh pending count
    const refreshCount = useCallback(async () => {
        const count = await getPendingCount();
        setPendingCount(count);
    }, []);

    // ── Submit ANC visit (offline-aware) ────────────────────────────────
    const submitAncVisit = useCallback(async (
        patientId: string,
        body: Record<string, unknown>,
        headers: Record<string, string> = {},
    ) => {
        const url = `/api/v1/patients/${patientId}/anc-visits`;
        const payload = JSON.stringify(body);

        if (!navigator.onLine) {
            // Offline → queue for later
            await enqueueRequest(url, payload, headers);
            await refreshCount();
            toast({
                title: 'Saved offline',
                description: 'ANC visit will sync when you reconnect.',
                variant: 'warning',
                duration: 4000,
            });
            return { offline: true };
        }

        // Online → try direct submit
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                body: payload,
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }

            const data = await response.json();
            toast({
                title: 'ANC visit recorded',
                description: `Next visit: ${data.data?.next_visit_date ?? 'TBD'}`,
                variant: 'success',
                duration: 3000,
            });
            return { offline: false, data };
        } catch {
            // Network failure mid-request → queue it
            await enqueueRequest(url, payload, headers);
            await refreshCount();
            toast({
                title: 'Network error — saved for sync',
                description: 'The visit will be submitted when connectivity returns.',
                variant: 'warning',
                duration: 4000,
            });
            return { offline: true };
        }
    }, [toast, refreshCount]);

    // ── Replay pending ──────────────────────────────────────────────────
    const syncPendingItems = useCallback(async () => {
        if (!navigator.onLine || syncLock.current) return;
        syncLock.current = true;
        setSyncing(true);

        try {
            const { synced, failed } = await replayPendingRequests();
            await refreshCount();

            if (synced > 0) {
                toast({
                    title: `${synced} item${synced > 1 ? 's' : ''} synced`,
                    description: failed > 0 ? `${failed} failed and will retry.` : 'All visits uploaded successfully.',
                    variant: 'success',
                    duration: 4000,
                });
            } else if (failed > 0) {
                toast({
                    title: 'Sync issues',
                    description: `${failed} item${failed > 1 ? 's' : ''} failed. Will retry later.`,
                    variant: 'error',
                    duration: 5000,
                });
            }
        } catch (error) {
            console.error('Sync replay failed', error);
        } finally {
            syncLock.current = false;
            setSyncing(false);
        }
    }, [toast, refreshCount]);

    // ── Online/Offline listeners ────────────────────────────────────────
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            toast({
                title: 'You\'re back online',
                description: 'Syncing pending data…',
                variant: 'default',
                duration: 2000,
            });
            syncPendingItems();
        };

        const handleOffline = () => {
            setIsOnline(false);
            toast({
                title: 'You\'re offline',
                description: 'Data will be saved locally and synced when reconnected.',
                variant: 'warning',
                duration: 3000,
            });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial sync if online
        if (navigator.onLine) {
            syncPendingItems();
        }

        // Refresh count on mount
        refreshCount();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [syncPendingItems, toast, refreshCount]);

    // ── Service Worker SYNC_SUCCESS messages ────────────────────────────
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data?.type === 'SYNC_SUCCESS') {
                toast({
                    title: 'Background sync complete',
                    description: 'A queued ANC visit was successfully submitted.',
                    variant: 'success',
                    duration: 3000,
                });
                refreshCount();
            }
        };

        navigator.serviceWorker?.addEventListener('message', handler);
        return () => {
            navigator.serviceWorker?.removeEventListener('message', handler);
        };
    }, [toast, refreshCount]);

    return {
        isOnline,
        syncing,
        pendingCount,
        submitAncVisit,
        syncPendingItems,
    };
}
