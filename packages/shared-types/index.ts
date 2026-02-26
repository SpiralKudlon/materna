import { z } from 'zod';

export const UserSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().min(1),
    role: z.enum(['admin', 'doctor', 'patient']),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

export const PatientSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    dateOfBirth: z.date(),
    medicalHistory: z.array(z.string()).optional(),
});

export type Patient = z.infer<typeof PatientSchema>;

export const SymptomSchema = z.object({
    id: z.string().uuid(),
    patientId: z.string().uuid(),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    reportedAt: z.date(),
});

export type Symptom = z.infer<typeof SymptomSchema>;

export const RiskScoreSchema = z.object({
    patientId: z.string().uuid(),
    score: z.number().min(0).max(100),
    calculatedAt: z.date(),
    factors: z.array(z.string()),
});

export type RiskScore = z.infer<typeof RiskScoreSchema>;
