import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '../ui/form';
import { Input } from '../ui/input';
import type { PatientRegistration } from '../../schemas/patientSchema';

export function PersonalDetails() {
    const { control } = useFormContext<PatientRegistration>();
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            <FormField
                control={control}
                name="personalDetails.fullName"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('registration.fields.fullName')}</FormLabel>
                        <FormControl>
                            <Input placeholder="Jane Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="personalDetails.dob"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('registration.fields.dob')}</FormLabel>
                        <FormControl>
                            <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}
