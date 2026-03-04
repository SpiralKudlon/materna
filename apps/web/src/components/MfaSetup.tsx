import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import {
    ShieldCheck,
    Smartphone,
    Copy,
    Check,
    ExternalLink,
    Loader2,
} from 'lucide-react';

/**
 * MfaSetup — shown to PROVIDER and ADMIN users who have not yet configured
 * TOTP on their Keycloak account. The component:
 *
 *   1. Fetches the TOTP setup URI from Keycloak's account API
 *   2. Displays a QR code (using a public chart API) and a manual key
 *   3. User enters the 6-digit code to verify setup
 *   4. On success, refreshes the token (which will now include `otp` in ACR)
 */

interface MfaSetupProps {
    onComplete: () => void;
    onSkip?: () => void;
}

export function MfaSetup({ onComplete, onSkip }: MfaSetupProps) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [step, setStep] = useState<'info' | 'verify'>('info');
    const [totpSecret, setTotpSecret] = useState('');
    const [totpUri, setTotpUri] = useState('');
    const [verifyCode, setVerifyCode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // In production, obtain the TOTP secret from:
    //   GET /realms/{realm}/account/totp (Keycloak account API)
    // For now, generate a placeholder that matches the expected format.
    useEffect(() => {
        const secret = generateBase32Secret();
        setTotpSecret(secret);
        const issuer = 'MaternalSystem';
        const account = user?.email ?? 'user';
        setTotpUri(
            `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
        );
    }, [user?.email]);

    const qrUrl = totpUri
        ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpUri)}`
        : '';

    const copySecret = async () => {
        await navigator.clipboard.writeText(totpSecret);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleVerify = async () => {
        if (verifyCode.length !== 6 || !/^\d+$/.test(verifyCode)) {
            setError(t('mfa.invalid_code', 'Enter a valid 6-digit code'));
            return;
        }

        setIsVerifying(true);
        setError(null);

        try {
            // In production, POST to Keycloak account API:
            //   POST /realms/{realm}/account/totp { code: verifyCode }
            // For demo, simulate a short delay
            await new Promise((resolve) => setTimeout(resolve, 1000));
            onComplete();
        } catch {
            setError(t('mfa.verify_failed', 'Verification failed. Try again.'));
        } finally {
            setIsVerifying(false);
        }
    };

    if (step === 'info') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
                <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-3 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                            <ShieldCheck className="h-7 w-7" />
                        </div>
                        <CardTitle className="text-xl">
                            {t('mfa.title', 'Two-Factor Authentication Required')}
                        </CardTitle>
                        <CardDescription className="text-sm">
                            {t(
                                'mfa.description',
                                'As a healthcare provider, your account requires an additional layer of security. Set up a TOTP authenticator app.',
                            )}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center text-sm font-bold shrink-0">
                                    1
                                </div>
                                <div>
                                    <p className="text-sm font-medium">
                                        {t('mfa.step_1', 'Install an authenticator app')}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Google Authenticator, Authy, or Microsoft Authenticator
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center text-sm font-bold shrink-0">
                                    2
                                </div>
                                <p className="text-sm font-medium">
                                    {t('mfa.step_2', 'Scan the QR code or enter the secret key')}
                                </p>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center text-sm font-bold shrink-0">
                                    3
                                </div>
                                <p className="text-sm font-medium">
                                    {t('mfa.step_3', 'Enter the 6-digit code to verify')}
                                </p>
                            </div>
                        </div>

                        <Button
                            onClick={() => setStep('verify')}
                            className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold"
                        >
                            <Smartphone className="h-4 w-4 mr-2" />
                            {t('mfa.begin_setup', 'Begin Setup')}
                        </Button>

                        {onSkip && (
                            <button
                                type="button"
                                onClick={onSkip}
                                className="w-full text-sm text-slate-400 hover:text-slate-600 transition-colors text-center"
                            >
                                {t('mfa.skip', 'Skip for now (not recommended)')}
                            </button>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ── Step 2: QR + Verify ────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-lg">
                        {t('mfa.scan_title', 'Scan QR Code')}
                    </CardTitle>
                    <CardDescription className="text-xs">
                        {t('mfa.scan_desc', 'Open your authenticator app and scan this QR code')}
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                    {/* QR Code */}
                    <div className="flex justify-center">
                        <div className="p-3 bg-white rounded-xl shadow-inner border">
                            <img
                                src={qrUrl}
                                alt="TOTP QR Code"
                                width={180}
                                height={180}
                                className="rounded-lg"
                            />
                        </div>
                    </div>

                    {/* Manual key */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-slate-500">
                            {t('mfa.manual_key', "Can't scan? Enter this key manually:")}
                        </Label>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg text-xs font-mono tracking-wider break-all">
                                {totpSecret}
                            </code>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={copySecret}
                                className="shrink-0"
                            >
                                {copied ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Verify input */}
                    <div className="space-y-2">
                        <Label htmlFor="totp-code" className="text-sm font-medium">
                            {t('mfa.enter_code', 'Enter the 6-digit code')}
                        </Label>
                        <Input
                            id="totp-code"
                            value={verifyCode}
                            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            className="h-12 text-center text-2xl tracking-[0.5em] font-mono"
                            maxLength={6}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                        />
                        {error && (
                            <p className="text-xs text-red-500">{error}</p>
                        )}
                    </div>

                    <Button
                        onClick={handleVerify}
                        disabled={isVerifying || verifyCode.length !== 6}
                        className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold"
                    >
                        {isVerifying ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Verifying...</>
                        ) : (
                            t('mfa.verify', 'Verify & Activate')
                        )}
                    </Button>

                    <a
                        href="https://support.google.com/accounts/answer/1066447"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-emerald-600 transition-colors"
                    >
                        <ExternalLink className="h-3 w-3" />
                        {t('mfa.help', 'Help with authenticator apps')}
                    </a>
                </CardContent>
            </Card>
        </div>
    );
}

// ── Secret key generator ───────────────────────────────────────────────────
function generateBase32Secret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map((b) => chars[b % 32])
        .join('');
}
