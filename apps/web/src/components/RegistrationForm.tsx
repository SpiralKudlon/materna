import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { PersonalDetails } from './steps/PersonalDetails';
import { ContactInfo } from './steps/ContactInfo';
import { MedicalHistory } from './steps/MedicalHistory';
import { Vitals } from './steps/Vitals';
import { Consents } from './steps/Consents';
import { patientRegistrationSchema, type PatientRegistration } from '../schemas/patientSchema';
import { db } from '../db/db';

const STEPS = [
    'personal',
    'contact',
    'medical',
    'vitals',
    'consents'
] as const;

export function RegistrationForm() {
    const { t } = useTranslation();
    const [currentStep, setCurrentStep] = useState(0);
    const [isSuccess, setIsSuccess] = useState(false);

    const methods = useForm<PatientRegistration>({
        resolver: zodResolver(patientRegistrationSchema),
        defaultValues: {
            personalDetails: { fullName: '', dob: '' },
            contactInfo: { phone: '', email: '' },
            medicalHistory: { hivStatus: 'UNKNOWN', pregnancyStatus: false },
            vitals: {},
            consents: { agreeDataProcessing: false }
        },
        mode: 'onTouched'
    });

    const stepName = STEPS[currentStep];

    const processSubmit = async (data: PatientRegistration) => {
        try {
            // Save directly to Dexie Outbox Queue
            await db.outbox.add({
                data,
                status: 'pending',
                createdAt: Date.now()
            });
            setIsSuccess(true);

            // Auto trigger sync queue if online handled by the global hook (in App.tsx)
        } catch (error) {
            console.error('Failed to save registration', error);
        }
    };

    const handleNext = async () => {
        // We validate only the current step's fields before proceeding
        let fieldsToValidate: any = [];
        if (currentStep === 0) fieldsToValidate = ['personalDetails.fullName', 'personalDetails.dob'];
        if (currentStep === 1) fieldsToValidate = ['contactInfo.phone', 'contactInfo.email'];
        if (currentStep === 2) fieldsToValidate = ['medicalHistory.hivStatus', 'medicalHistory.pregnancyStatus'];
        if (currentStep === 3) fieldsToValidate = ['vitals.bloodPressureSystolic', 'vitals.bloodPressureDiastolic'];
        if (currentStep === 4) fieldsToValidate = ['consents.agreeDataProcessing'];

        const isValid = await methods.trigger(fieldsToValidate);

        if (isValid) {
            if (currentStep === STEPS.length - 1) {
                processSubmit(methods.getValues());
            } else {
                setCurrentStep(prev => prev + 1);
            }
        }
    };

    const handleBack = () => {
        setCurrentStep(prev => Math.max(0, prev - 1));
    };

    if (isSuccess) {
        return (
            <Card className="w-full max-w-lg mx-auto mt-8">
                <CardHeader>
                    <CardTitle className="text-green-600">Success!</CardTitle>
                    <CardDescription>{t('registration.success')}</CardDescription>
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
            <CardHeader>
                <div className="flex justify-between items-center mb-2">
                    <CardTitle className="text-2xl font-bold">{t('registration.title')}</CardTitle>
                    <span className="text-sm rounded-full bg-primary/10 text-primary px-3 py-1 font-medium">
                        Step {currentStep + 1} of {STEPS.length}
                    </span>
                </div>
                <CardDescription>
                    {t(`registration.steps.${stepName}`)}
                </CardDescription>
            </CardHeader>

            <CardContent>
                <FormProvider {...methods}>
                    <form className="space-y-6">
                        {currentStep === 0 && <PersonalDetails />}
                        {currentStep === 1 && <ContactInfo />}
                        {currentStep === 2 && <MedicalHistory />}
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
                <Button onClick={handleNext}>
                    {currentStep === STEPS.length - 1
                        ? t('registration.buttons.submit')
                        : t('registration.buttons.next')}
                </Button>
            </CardFooter>
        </Card>
    );
}
