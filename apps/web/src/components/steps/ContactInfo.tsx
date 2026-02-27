import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '../ui/form';
import { Input } from '../ui/input';
import type { PatientRegistration } from '../../schemas/patientSchema';

export function ContactInfo() {
    const { control } = useFormContext<PatientRegistration>();
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            <FormField
                control={control}
                name="contactInfo.phone"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('registration.fields.phone')}</FormLabel>
                        <FormControl>
                            <Input type="tel" placeholder="+254..." {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="contactInfo.email"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('registration.fields.email')} (Optional)</FormLabel>
                        <FormControl>
                            <Input type="email" placeholder="jane@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}
