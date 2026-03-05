/**
 * RegistrationForm — 5-step wizard with IndexedDB draft persistence.
 *
 * Steps:
 *   1. Personal Details (name, DOB, phone, email, NID)
 *   2. Pregnancy Info    (pregnancy status, gestational age 0–42, LMP, G/P, EDD)
 *   3. Medical History   (HIV with role masking, blood type, allergies, conditions)
 *   4. Vitals            (BP, weight, height)
 *   5. Consent           (data processing + HIV disclosure)
 *
 * Features:
 *   • Dexie.js saves draft to IndexedDB on every step (forward or backward)
 *   • On refresh, the form restores to the exact step + values
 *   • Step 2 → 3 transition blocked unless gestationalAgeWeeks passes 0–42 validation
 *   • HIV field masked for CHV, visible for PROVIDER/ADMIN
 */
import { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import type { Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { PersonalDetails } from './steps/PersonalDetails';
import { PregnancyInfo } from './steps/PregnancyInfo';
import { MedicalHistory } from './steps/MedicalHistory';
import { Vitals } from './steps/Vitals';
import { Consents } from './steps/Consents';
import { patientRegistrationSchema, type PatientRegistration } from '../schemas/patientSchema';
import { db } from '../db/db';
import { useFormDraft } from '../hooks/useFormDraft';
import { useAuth } from '../contexts/AuthContext';

const STEPS = [
    'personal',
    'pregnancy',
    'medical',
    'vitals',
    'consents',
] as const;

const STEP_LABELS: Record<typeof STEPS[number], string> = {
    personal: 'Personal Details',
    pregnancy: 'Pregnancy Info',
    medical: 'Medical History',
    vitals: 'Vitals',
    consents: 'Consent',
};

/** Fields that must be valid before proceeding from each step. */
const STEP_FIELDS: Record<number, Path<PatientRegistration>[]> = {
    0: ['personalDetails.fullName', 'personalDetails.dob', 'personalDetails.phone'],
    1: ['pregnancyInfo.pregnancyStatus', 'pregnancyInfo.gestationalAgeWeeks'],
    2: ['medicalHistory.hivStatus'],
    3: [],                           // vitals are optional
    4: ['consents.agreeDataProcessing'],
};

export function RegistrationForm() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const userRoles = user?.roles ?? [];

    const [currentStep, setCurrentStep] = useState(0);
    const [isSuccess, setIsSuccess] = useState(false);

    const methods = useForm<PatientRegistration>({
        resolver: zodResolver(patientRegistrationSchema),
        defaultValues: {
            personalDetails: { fullName: '', dob: '', phone: '', email: '' },
            pregnancyInfo: { pregnancyStatus: false },
            medicalHistory: { hivStatus: 'UNKNOWN' },
            vitals: {},
            consents: { agreeDataProcessing: false },
        },
        mode: 'onTouched',
    });

    const { saveDraft, clearDraft, draftLoaded, restoredStep } = useFormDraft(methods);

    // Restore step from draft after mount
    useEffect(() => {
        if (draftLoaded.current) {
            setCurrentStep(restoredStep.current);
        }
    }, [draftLoaded, restoredStep]);

    const stepName = STEPS[currentStep];

    // ── Submit ──────────────────────────────────────────────────────────
    const processSubmit = async (data: PatientRegistration) => {
        try {
            await db.outbox.add({
                data,
                status: 'pending',
                createdAt: Date.now(),
            });
            await clearDraft();
            setIsSuccess(true);
        } catch (error) {
            console.error('Failed to save registration', error);
        }
    };

    // ── Navigation ──────────────────────────────────────────────────────
    const handleNext = async () => {
        const fieldsToValidate = STEP_FIELDS[currentStep] ?? [];
        const isValid = fieldsToValidate.length === 0 || await methods.trigger(fieldsToValidate);

        if (!isValid) return;

        if (currentStep === STEPS.length - 1) {
            await processSubmit(methods.getValues());
        } else {
            const nextStep = currentStep + 1;
            setCurrentStep(nextStep);
            await saveDraft(nextStep);
        }
    };

    const handleBack = async () => {
        const prevStep = Math.max(0, currentStep - 1);
        setCurrentStep(prevStep);
        await saveDraft(prevStep);
    };

    // ── Progress bar ────────────────────────────────────────────────────
    const progress = ((currentStep + 1) / STEPS.length) * 100;

    // ── Success ─────────────────────────────────────────────────────────
    if (isSuccess) {
        return (
            <Card className="w-full max-w-lg mx-auto mt-8">
                <CardHeader>
                    <CardTitle className="text-green-600">✓ Registration Saved</CardTitle>
                    <CardDescription>
                        {t('registration.success')}
                    </CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button onClick={() => {
                        methods.reset();
                        setCurrentStep(0);
                        setIsSuccess(false);
                    }}>
                        New Registration
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-lg mx-auto mt-8 shadow-lg border-t-4 border-t-primary">
            {/* ── Progress bar ─────────────────────────────────────── */}
            <div className="w-full h-1.5 bg-muted rounded-t-lg overflow-hidden">
                <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>

            <CardHeader>
                <div className="flex justify-between items-center mb-2">
                    <CardTitle className="text-2xl font-bold">{t('registration.title')}</CardTitle>
                    <span className="text-sm rounded-full bg-primary/10 text-primary px-3 py-1 font-medium">
                        {currentStep + 1} / {STEPS.length}
                    </span>
                </div>
                <CardDescription>
                    {STEP_LABELS[stepName]}
                </CardDescription>

                {/* Step indicators */}
                <div className="flex gap-1.5 mt-3">
                    {STEPS.map((_, idx) => (
                        <div
                            key={idx}
                            className={`h-1 flex-1 rounded-full transition-colors ${idx <= currentStep ? 'bg-primary' : 'bg-muted'
                                }`}
                        />
                    ))}
                </div>
            </CardHeader>

            <CardContent>
                <FormProvider {...methods}>
                    <form className="space-y-6" onSubmit={e => e.preventDefault()}>
                        {currentStep === 0 && <PersonalDetails />}
                        {currentStep === 1 && <PregnancyInfo />}
                        {currentStep === 2 && <MedicalHistory userRoles={userRoles} />}
                        {currentStep === 3 && <Vitals />}
                        {currentStep === 4 && <Consents />}
                    </form>
                </FormProvider>
            </CardContent>

            <CardFooter className="flex justify-between border-t pt-6 bg-muted/20">
                <Button
                    variant="outline"
                    onClick={handleBack}
                    disabled={currentStep === 0}
                >
                    {t('registration.buttons.back')}
                </Button>

                <div className="flex gap-2 items-center">
                    <span className="text-xs text-muted-foreground">
                        Auto-saved to device
                    </span>
                    <Button onClick={handleNext}>
                        {currentStep === STEPS.length - 1
                            ? t('registration.buttons.submit')
                            : t('registration.buttons.next')}
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
