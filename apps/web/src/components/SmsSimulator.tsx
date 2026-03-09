import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
// import { Textarea } from './ui/textarea';
import { Smartphone, Send, Terminal, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SimulationResult {
    simulatedPhone: string;
    parsedCommand: {
        type: string;
        symptom?: string;
        severity?: string;
        raw: string;
    };
    simulatedReply: string;
}

export function SmsSimulator() {
    const [phoneNumber, setPhoneNumber] = useState('+254700000000');
    const [message, setMessage] = useState('LOG HEDACHE SEVERE');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<SimulationResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { user } = useAuth();
    // In actual implementation token should come from AuthContext or session, mocking for now if not available directly
    const token = (user as any)?.token || '';

    const handleSimulate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            // In production, SMS bridge should be routed through a proper gateway.
            // For local development, assuming it's running on 3003
            const response = await fetch('http://localhost:3003/api/v1/sms/simulate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    phone: phoneNumber,
                    text: message
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to simulate: ${response.statusText}`);
            }

            const data = await response.json();
            setResult(data);
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="w-full shadow-lg border-primary/20 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
            <CardHeader className="border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-primary" />
                    Virtual Phone Simulator
                </CardTitle>
                <CardDescription>
                    Test the SMS logic and fuzzy-matching engine safely without spending messaging credits.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6 grid gap-6 md:grid-cols-2">
                {/* Left Column: Input Form */}
                <div className="space-y-4">
                    <form onSubmit={handleSimulate} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="sim-phone" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Mock Sender Phone Number
                            </label>
                            <Input
                                id="sim-phone"
                                placeholder="+254700000000"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                required
                                className="font-mono bg-white dark:bg-slate-900"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="sim-msg" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                SMS Payload Body
                            </label>
                            <textarea
                                id="sim-msg"
                                placeholder="LOG BLEEDING MODERATE"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                required
                                className="font-mono min-h-[120px] bg-white dark:bg-slate-900 flex w-full rounded-md border border-slate-200 px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300"
                            />
                        </div>

                        <Button type="submit" disabled={loading} className="w-full flex items-center gap-2">
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-transparent" />
                                    Simulating...
                                </div>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    Dispatch Mock Webhook
                                </>
                            )}
                        </Button>
                    </form>

                    {error && (
                        <div className="p-3 mt-4 text-sm text-red-500 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-md flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                {/* Right Column: Results Console */}
                <div className="bg-slate-950 rounded-lg p-4 font-mono text-sm shadow-inner relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 left-0 w-full h-8 bg-slate-900 flex items-center px-4 border-b border-slate-800">
                        <Terminal className="h-4 w-4 text-slate-400 mr-2" />
                        <span className="text-xs text-slate-400 font-semibold tracking-wider">SMS-BRIDGE INTERPRETER</span>
                    </div>

                    <div className="pt-8 flex-grow overflow-y-auto min-h-[250px] text-slate-300 space-y-4">
                        {!result && !loading && (
                            <div className="flex h-full items-center justify-center text-slate-600 italic">
                                Awaiting transmission...
                            </div>
                        )}

                        {loading && (
                            <div className="text-emerald-500 animate-pulse flex flex-col gap-2">
                                <span>{'> POST /api/v1/sms/simulate'}</span>
                                <span>{'> Parsing language structures...'}</span>
                            </div>
                        )}

                        {result && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="mb-4">
                                    <span className="text-emerald-400 font-bold block mb-1">{'> ENGINE INTERPRETATION'}</span>
                                    <pre className="bg-slate-900/80 p-3 rounded border border-slate-800 text-emerald-300 overflow-x-auto">
                                        {JSON.stringify(result.parsedCommand, null, 2)}
                                    </pre>
                                </div>

                                <div>
                                    <span className="text-blue-400 font-bold block mb-1">{'> SIMULATED AT OUTBOUND SMS'}</span>
                                    <div className="bg-blue-950/30 p-3 rounded border border-blue-900/50 text-blue-200">
                                        <span className="opacity-70 text-xs block mb-1">TO: {result.simulatedPhone}</span>
                                        <p className="whitespace-pre-wrap">{result.simulatedReply}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
