import { z } from 'zod';

export const loginSchema = z.object({
    identifier: z
        .string()
        .min(1, 'Email or phone number is required')
        .refine(
            (val) =>
                val.includes('@')
                    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
                    : /^\+?[0-9]{10,15}$/.test(val),
            { message: 'Enter a valid email address or phone number' },
        ),
    password: z.string().min(1, 'Password is required'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
