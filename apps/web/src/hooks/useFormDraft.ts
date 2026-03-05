/**
 * useFormDraft — persists React Hook Form state to IndexedDB via Dexie.
 *
 * On mount, loads any saved draft from IndexedDB and resets the form.
 * On every step change (or explicit save), writes the current values to IndexedDB.
 * On final submit, deletes the draft.
 */
import { useEffect, useCallback, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { db, type FormDraft } from '../db/db';
import type { PatientRegistration } from '../schemas/patientSchema';

const DRAFT_KEY = 'registration-draft';

interface UseFormDraftReturn {
    /** Save current form values + step to IndexedDB */
    saveDraft: (step: number) => Promise<void>;
    /** Delete the draft (call after successful submit) */
    clearDraft: () => Promise<void>;
    /** Whether the draft was loaded on mount */
    draftLoaded: React.MutableRefObject<boolean>;
    /** The initial step restored from the draft */
    restoredStep: React.MutableRefObject<number>;
}

export function useFormDraft(
    methods: UseFormReturn<PatientRegistration>,
): UseFormDraftReturn {
    const draftLoaded = useRef(false);
    const restoredStep = useRef(0);

    // Load draft on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const draft = await db.drafts.get(DRAFT_KEY);
                if (draft && !cancelled) {
                    methods.reset(draft.data as PatientRegistration);
                    restoredStep.current = draft.currentStep;
                    draftLoaded.current = true;
                }
            } catch (err) {
                console.warn('Failed to load draft from IndexedDB', err);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const saveDraft = useCallback(async (step: number) => {
        try {
            const values = methods.getValues();
            const draft: FormDraft = {
                id: DRAFT_KEY,
                data: values,
                currentStep: step,
                updatedAt: Date.now(),
            };
            await db.drafts.put(draft);
        } catch (err) {
            console.warn('Failed to save draft to IndexedDB', err);
        }
    }, [methods]);

    const clearDraft = useCallback(async () => {
        try {
            await db.drafts.delete(DRAFT_KEY);
        } catch (err) {
            console.warn('Failed to clear draft from IndexedDB', err);
        }
    }, []);

    return { saveDraft, clearDraft, draftLoaded, restoredStep };
}
