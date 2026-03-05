/**
 * Step 2: Pregnancy Information
 *
 * gestational_age_weeks is validated 0–42 by the Zod schema.
 * The user cannot proceed to Step 3 unless this field passes validation.
 */
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '../ui/form';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import type { PatientRegistration } from '../../schemas/patientSchema';

export function PregnancyInfo() {
    const { control, watch } = useFormContext<PatientRegistration>();
    const { t } = useTranslation();
    const isPregnant = watch('pregnancyInfo.pregnancyStatus');

    return (
        <div className="space-y-4">
            <FormField
                control={control}
                name="pregnancyInfo.pregnancyStatus"
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

            {isPregnant && (
                <>
                    <FormField
                        control={control}
                        name="pregnancyInfo.gestationalAgeWeeks"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>
                                    Gestational Age (weeks) <span className="text-destructive">*</span>
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={42}
                                        placeholder="0 – 42"
                                        {...field}
                                        value={field.value ?? ''}
                                        onChange={e =>
                                            field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)
                                        }
                                    />
                                </FormControl>
                                <FormMessage />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Must be between 0 and 42 weeks to proceed.
                                </p>
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={control}
                        name="pregnancyInfo.lastMenstrualPeriod"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Last Menstrual Period (LMP)</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={control}
                            name="pregnancyInfo.gravida"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Gravida</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={0}
                                            placeholder="Total pregnancies"
                                            {...field}
                                            value={field.value ?? ''}
                                            onChange={e =>
                                                field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={control}
                            name="pregnancyInfo.para"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Para</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={0}
                                            placeholder="Births ≥ 28 wks"
                                            {...field}
                                            value={field.value ?? ''}
                                            onChange={e =>
                                                field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={control}
                        name="pregnancyInfo.expectedDueDate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Expected Due Date</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </>
            )}
        </div>
    );
}
