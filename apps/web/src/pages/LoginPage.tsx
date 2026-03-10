import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { loginSchema, type LoginFormData } from '../schemas/loginSchema';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import {
    Activity,
    Eye,
    EyeOff,
    AlertCircle,
    Loader2,
    ShieldAlert,
} from 'lucide-react';

type LoginMode = 'email' | 'phone';

export function LoginPage() {
    const { t } = useTranslation();
    const { login, isLoading, error, clearError } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [mode, setMode] = useState<LoginMode>('email');

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: { identifier: '', password: '' },
    });

    const onSubmit = async (data: LoginFormData) => {
        clearError();
        try {
            await login(data.identifier, data.password);
            // Navigation handled by the router guard in App.tsx
        } catch {
            // Error is already set in AuthContext
        }
    };

    const toggleMode = () => {
        clearError();
        setMode((prev) => (prev === 'email' ? 'phone' : 'email'));
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-[400px]">
                {/* Logo section */}
                <div className="mb-8 text-center sm:text-left flex flex-col items-center sm:items-start gap-2">
                    <div className="flex items-center justify-center w-10 h-10 rounded-md bg-foreground text-background mb-2">
                        <Activity className="h-5 w-5" />
                    </div>
                    <h1 className="text-xl font-semibold text-foreground tracking-tight">
                        {t('login.title', 'Maternal System')}
                    </h1>
                </div>

                <Card className="rounded-lg border bg-card shadow-sm">
                    <CardContent className="p-6">
                        {/* Error banner */}
                        {error && (
                            <div
                                id="login-error"
                                className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400 animate-in slide-in-from-top-2"
                                role="alert"
                            >
                                {error.includes('suspended') ? (
                                    <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                                )}
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                            {/* Identifier field */}
                            <div className="space-y-2">
                                <Label htmlFor="identifier" className="text-sm font-medium">
                                    {mode === 'email' ? t('login.email', 'Email') : t('login.phone', 'Phone number')}
                                </Label>
                                <Input
                                    id="identifier"
                                    type={mode === 'email' ? 'email' : 'tel'}
                                    placeholder={
                                        mode === 'email'
                                            ? t('login.email_placeholder', 'name@example.com')
                                            : t('login.phone_placeholder', '+254712345678')
                                    }
                                    autoComplete={mode === 'email' ? 'email' : 'tel'}
                                    className="h-11"
                                    {...register('identifier')}
                                />
                                {errors.identifier && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        {errors.identifier.message}
                                    </p>
                                )}
                            </div>

                            {/* Password field */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="text-sm font-medium">
                                        {t('login.password', 'Password')}
                                    </Label>
                                    <a
                                        href="/forgot-password"
                                        className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                                    >
                                        {t('login.forgot', 'Forgot password?')}
                                    </a>
                                </div>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        className="h-11 pr-10"
                                        {...register('password')}
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                        tabIndex={-1}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        {errors.password.message}
                                    </p>
                                )}
                            </div>

                            {/* Submit */}
                            <Button
                                id="login-submit"
                                type="submit"
                                disabled={isLoading}
                                className="w-full mt-2"
                            >
                                {isLoading ? (
                                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('login.signing_in', 'Signing in...')}</>
                                ) : (
                                    t('login.submit', 'Sign in')
                                )}
                            </Button>
                        </form>

                        {/* Mode toggle */}
                        <div className="mt-6 text-center">
                            <button
                                type="button"
                                onClick={toggleMode}
                                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {mode === 'email'
                                    ? t('login.use_phone', 'Use phone number instead')
                                    : t('login.use_email', 'Use email instead')}
                            </button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
