import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { loginSchema, type LoginFormData } from '../schemas/loginSchema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import {
    Activity,
    Eye,
    EyeOff,
    AlertCircle,
    Lock,
    Mail,
    Phone,
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
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
            />

            <div className="w-full max-w-md relative z-10">
                {/* Logo section */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 mb-4">
                        <Activity className="h-8 w-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
                        {t('login.title', 'Maternal System')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('login.subtitle', 'Sign in to continue')}
                    </p>
                </div>

                <Card className="shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg">
                            {t('login.heading', 'Welcome back')}
                        </CardTitle>
                        <CardDescription>
                            {mode === 'email'
                                ? t('login.email_prompt', 'Enter your email and password')
                                : t('login.phone_prompt', 'Enter your phone number and password')}
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
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
                                <Label htmlFor="identifier" className="flex items-center gap-1.5 text-sm font-medium">
                                    {mode === 'email' ? (
                                        <><Mail className="h-3.5 w-3.5" /> {t('login.email', 'Email')}</>
                                    ) : (
                                        <><Phone className="h-3.5 w-3.5" /> {t('login.phone', 'Phone')}</>
                                    )}
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
                                    <Label htmlFor="password" className="flex items-center gap-1.5 text-sm font-medium">
                                        <Lock className="h-3.5 w-3.5" /> {t('login.password', 'Password')}
                                    </Label>
                                    <a
                                        href="/forgot-password"
                                        className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline"
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
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
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
                                className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-md shadow-emerald-500/20 transition-all duration-200"
                            >
                                {isLoading ? (
                                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('login.signing_in', 'Signing in...')}</>
                                ) : (
                                    t('login.submit', 'Sign in')
                                )}
                            </Button>
                        </form>

                        {/* Mode toggle */}
                        <div className="mt-5 pt-5 border-t text-center">
                            <button
                                type="button"
                                onClick={toggleMode}
                                className="text-sm text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            >
                                {mode === 'email'
                                    ? t('login.use_phone', 'Use phone number instead')
                                    : t('login.use_email', 'Use email instead')}
                            </button>
                        </div>
                    </CardContent>
                </Card>

                <p className="text-center text-xs text-slate-400 mt-6">
                    © {new Date().getFullYear()} Maternal System
                </p>
            </div>
        </div>
    );
}
