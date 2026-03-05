import { z } from 'zod';

// ── Step 1: Personal Details ───────────────────────────────────────────
export const personalSchema = z.object({
    fullName: z.string().min(2, "Full name is required"),
    dob: z.string().min(1, "Date of birth is required"),
    phone: z.string().min(10, "Phone number must be at least 10 digits"),
    email: z.string().email("Invalid email address").optional().or(z.literal("")),
    nationalId: z.string().optional(),
});

// ── Step 2: Pregnancy Info ─────────────────────────────────────────────
export const pregnancySchema = z.object({
    pregnancyStatus: z.boolean(),
    gestationalAgeWeeks: z.number({ invalid_type_error: "Must be a number" })
        .int("Must be a whole number")
        .min(0, "Gestational age must be at least 0")
        .max(42, "Gestational age cannot exceed 42 weeks")
        .optional(),
    lastMenstrualPeriod: z.string().optional(),
    gravida: z.number().int().min(0).optional(),
    para: z.number().int().min(0).optional(),
    expectedDueDate: z.string().optional(),
});

// ── Step 3: Medical History ────────────────────────────────────────────
export const medicalSchema = z.object({
    hivStatus: z.enum(["POSITIVE", "NEGATIVE", "UNKNOWN"]),
    bloodType: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "UNKNOWN"]).optional(),
    allergies: z.string().optional(),           // comma-separated
    conditions: z.string().optional(),          // free text
});

// ── Step 4: Vitals ─────────────────────────────────────────────────────
export const vitalsSchema = z.object({
    bloodPressureSystolic: z.number().min(50).max(250).optional(),
    bloodPressureDiastolic: z.number().min(30).max(150).optional(),
    weightKg: z.number().min(20).max(300).optional(),
    heightCm: z.number().min(100).max(250).optional(),
});

// ── Step 5: Consent ────────────────────────────────────────────────────
export const consentsSchema = z.object({
    agreeDataProcessing: z.boolean().refine(val => val === true, {
        message: "You must agree to data processing"
    }),
    agreeHivDisclosure: z.boolean().optional(),
});

// ── Combined form ──────────────────────────────────────────────────────
export const patientRegistrationSchema = z.object({
    personalDetails: personalSchema,
    pregnancyInfo: pregnancySchema,
    medicalHistory: medicalSchema,
    vitals: vitalsSchema,
    consents: consentsSchema,
});

export type PatientRegistration = z.infer<typeof patientRegistrationSchema>;
