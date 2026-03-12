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

// === Registration Form Schemas ===

export const PersonalInfoSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  nationalId: z.string().min(6, 'National ID must be at least 6 characters'),
  dateOfBirth: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid Date of Birth' }),
  phone: z.string().min(10, 'Valid phone number required'),
});

export type PersonalInfo = z.infer<typeof PersonalInfoSchema>;

export const PregnancyInfoSchema = z.object({
  lastMenstrualPeriod: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid LMP Date' }),
  estimatedDateOfDelivery: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid EDD' }),
  gravida: z.coerce.number().min(1, 'Must be at least 1 (Current pregnancy)'),
  parity: z.coerce.number().min(0, 'Cannot be negative'),
});

export type PregnancyInfo = z.infer<typeof PregnancyInfoSchema>;

export const MedicalHistorySchema = z.object({
  existingConditions: z.array(z.string()).default([]),
  allergies: z.array(z.string()).default([]),
  previousComplications: z.array(z.string()).default([]),
});

export type MedicalHistory = z.infer<typeof MedicalHistorySchema>;

export const EmergencyContactSchema = z.object({
  name: z.string().min(2, 'Emergency contact name is required'),
  relationship: z.string().min(2, 'Relationship is required'),
  phone: z.string().min(10, 'Valid emergency phone number required'),
});

export type EmergencyContact = z.infer<typeof EmergencyContactSchema>;

export const PatientRegistrationSchema = z.object({
  personalInfo: PersonalInfoSchema,
  pregnancyInfo: PregnancyInfoSchema,
  medicalHistory: MedicalHistorySchema,
  emergencyContact: EmergencyContactSchema,
});

export type PatientRegistration = z.infer<typeof PatientRegistrationSchema>;
