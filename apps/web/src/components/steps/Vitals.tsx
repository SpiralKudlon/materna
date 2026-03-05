import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '../ui/form';
import { Input } from '../ui/input';
import type { PatientRegistration } from '../../schemas/patientSchema';

export function Vitals() {
    const { control } = useFormContext<PatientRegistration>();
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={control}
                    name="vitals.bloodPressureSystolic"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('registration.fields.systolic')}</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    placeholder="mmHg"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={e => field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={control}
                    name="vitals.bloodPressureDiastolic"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('registration.fields.diastolic')}</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    placeholder="mmHg"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={e => field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={control}
                    name="vitals.weightKg"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Weight (kg)</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    step="0.1"
                                    placeholder="kg"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={control}
                    name="vitals.heightCm"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Height (cm)</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    step="0.1"
                                    placeholder="cm"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
}
