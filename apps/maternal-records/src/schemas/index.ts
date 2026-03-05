import { z } from 'zod';

// ── Patients ───────────────────────────────────────────────────────────

export const createPatientSchema = z.object({
    full_name: z.string().min(2, 'Name must be at least 2 characters'),
    phone: z.string().min(10, 'Phone must be at least 10 digits').regex(/^\+?[0-9]+$/),
    date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format').optional(),
    sex: z.enum(['F', 'M', 'OTHER']).optional(),
    national_id: z.string().optional(),
});
export type CreatePatientInput = z.infer<typeof createPatientSchema>;

export const updatePatientSchema = createPatientSchema.partial();
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

// ── ANC Visits ─────────────────────────────────────────────────────────

export const createAncVisitSchema = z.object({
    visit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format').optional(),
    bp_systolic: z.number().int().min(60).max(260).optional(),
    bp_diastolic: z.number().int().min(30).max(160).optional(),
    weight_kg: z.number().min(20).max(300).optional(),
    height_cm: z.number().min(100).max(250).optional(),
    fundal_height_cm: z.number().optional(),
    fetal_heart_rate: z.number().int().min(80).max(220).optional(),
    gestational_age_weeks: z.number().int().min(1).max(45),
    notes: z.string().max(2000).optional(),
});
export type CreateAncVisitInput = z.infer<typeof createAncVisitSchema>;

// ── Medication Log ─────────────────────────────────────────────────────

export const logMedicationSchema = z.object({
    medication_name: z.string().min(1, 'Medication name is required'),
    action: z.enum(['TAKEN', 'SKIPPED']),
    scheduled_at: z.string().datetime({ message: 'ISO 8601 datetime required' }).optional(),
    notes: z.string().max(500).optional(),
});
export type LogMedicationInput = z.infer<typeof logMedicationSchema>;
