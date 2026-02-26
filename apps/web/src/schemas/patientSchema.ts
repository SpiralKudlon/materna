import { z } from 'zod';

export const personalSchema = z.object({
    fullName: z.string().min(2, "Full name is required"),
    dob: z.string().min(1, "Date of birth is required"),
});

export const contactSchema = z.object({
    phone: z.string().min(10, "Phone number must be at least 10 digits"),
    email: z.string().email("Invalid email address").optional().or(z.literal("")),
});

export const medicalSchema = z.object({
    hivStatus: z.enum(["POSITIVE", "NEGATIVE", "UNKNOWN"]),
    pregnancyStatus: z.boolean(),
});

export const vitalsSchema = z.object({
    bloodPressureSystolic: z.number().min(50).max(250).optional(),
    bloodPressureDiastolic: z.number().min(30).max(150).optional(),
});

export const consentsSchema = z.object({
    agreeDataProcessing: z.boolean().refine(val => val === true, {
        message: "You must agree to data processing"
    })
});

export const patientRegistrationSchema = z.object({
    personalDetails: personalSchema,
    contactInfo: contactSchema,
    medicalHistory: medicalSchema,
    vitals: vitalsSchema,
    consents: consentsSchema,
});

export type PatientRegistration = z.infer<typeof patientRegistrationSchema>;
