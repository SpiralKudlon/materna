import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormField, FormItem, FormLabel, FormControl } from '../ui/form';
import { Checkbox } from '../ui/checkbox';
import type { PatientRegistration } from '../../schemas/patientSchema';

export function Consents() {
    const { control } = useFormContext<PatientRegistration>();
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            <FormField
                control={control}
                name="consents.agreeDataProcessing"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md bg-muted/50">
                        <FormControl>
                            <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel>
                                {t('registration.fields.agreeData')}
                            </FormLabel>
                        </div>
                    </FormItem>
                )}
            />
        </div>
    );
}
