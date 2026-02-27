import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import type { PatientRegistration } from '../../schemas/patientSchema';

export function MedicalHistory() {
    const { control } = useFormContext<PatientRegistration>();
    const { t } = useTranslation();

    return (
        <div className="space-y-6">
            <FormField
                control={control}
                name="medicalHistory.hivStatus"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('registration.fields.hivStatus')}</FormLabel>
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
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="medicalHistory.pregnancyStatus"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md">
                        <FormControl>
                            <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel>
                                {t('registration.fields.pregnancyStatus')}
                            </FormLabel>
                        </div>
                    </FormItem>
                )}
            />
        </div>
    );
}
