/**
 * Step 3: Medical History
 *
 * Role-based HIV masking:
 *   • PROVIDER / ADMIN → full HIV status displayed
 *   • CHV / other      → HIV field is masked (shows "●●●●●●●●")
 *
 * The actual value is still stored in the form — only the *display* is masked.
 */
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import type { PatientRegistration } from '../../schemas/patientSchema';

interface MedicalHistoryProps {
    /** Current user roles from AuthContext — e.g. ['CHV'], ['PROVIDER'], ['ADMIN'] */
    userRoles: string[];
}

export function MedicalHistory({ userRoles }: MedicalHistoryProps) {
    const { control } = useFormContext<PatientRegistration>();
    const { t } = useTranslation();

    // Determine if the current user can see HIV status
    const canViewHiv = userRoles.some(r =>
        ['provider', 'admin'].includes(r.toLowerCase()),
    );

    // Allow PROVIDER to toggle masking temporarily
    const [isMasked, setIsMasked] = useState(!canViewHiv);

    return (
        <div className="space-y-4">
            {/* ── HIV Status ────────────────────────────────────────── */}
            <FormField
                control={control}
                name="medicalHistory.hivStatus"
                render={({ field }) => (
                    <FormItem>
                        <div className="flex items-center justify-between">
                            <FormLabel>{t('registration.fields.hivStatus')}</FormLabel>
                            {canViewHiv && (
                                <button
                                    type="button"
                                    className="text-xs text-primary underline"
                                    onClick={() => setIsMasked(prev => !prev)}
                                >
                                    {isMasked ? 'Show' : 'Hide'}
                                </button>
                            )}
                        </div>

                        {isMasked ? (
                            /* Masked view for CHV or when PROVIDER toggles off */
                            <div className="flex items-center h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-muted-foreground">
                                <span className="tracking-widest">●●●●●●●●</span>
                                <span className="ml-auto text-xs">
                                    {canViewHiv ? 'Click Show to reveal' : 'Restricted — PROVIDER access only'}
                                </span>
                            </div>
                        ) : (
                            /* Full select for PROVIDER/ADMIN */
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="NEGATIVE">Negative</SelectItem>
                                    <SelectItem value="POSITIVE">Positive</SelectItem>
                                    <SelectItem value="UNKNOWN">Unknown</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                        <FormMessage />
                    </FormItem>
                )}
            />

            {/* ── Blood Type ────────────────────────────────────────── */}
            <FormField
                control={control}
                name="medicalHistory.bloodType"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Blood Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select blood type" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "UNKNOWN"].map(v => (
                                    <SelectItem key={v} value={v}>{v}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {/* ── Allergies ─────────────────────────────────────────── */}
            <FormField
                control={control}
                name="medicalHistory.allergies"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Allergies (comma-separated)</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g. Penicillin, Latex" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {/* ── Pre-existing Conditions ───────────────────────────── */}
            <FormField
                control={control}
                name="medicalHistory.conditions"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Pre-existing Conditions</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g. Hypertension, Diabetes" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}
