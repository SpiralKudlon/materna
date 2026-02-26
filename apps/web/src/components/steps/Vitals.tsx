import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '../ui/form';
import { Input } from '../ui/input';
import { PatientRegistration } from '../../schemas/patientSchema';

export function Vitals() {
    const { control } = useFormContext<PatientRegistration>();
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            <FormField
                control={control}
                name="vitals.bloodPressureSystolic"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('registration.fields.systolic')}</FormLabel>
                        <FormControl>
                            <Input
                                type="number"
                                {...field}
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
                                {...field}
                                onChange={e => field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}
