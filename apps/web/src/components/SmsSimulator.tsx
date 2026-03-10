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
        <Card className="w-full shadow-sm border">
            <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
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

                {/* Right Column: Results Console - Normalized */}
                <div className="rounded-md border bg-muted/30 p-4 font-mono text-sm flex flex-col min-h-[300px]">
                    <div className="flex items-center border-b pb-2 mb-4">
                        <Terminal className="h-4 w-4 text-muted-foreground mr-2" />
                        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">SMS-Bridge Log</span>
                    </div>

                    <div className="flex-grow overflow-y-auto space-y-4">
                        {!result && !loading && (
                            <div className="flex h-full items-center justify-center text-muted-foreground italic">
                                Awaiting transmission...
                            </div>
                        )}

                        {loading && (
                            <div className="text-muted-foreground animate-pulse flex flex-col gap-1">
                                <span>{'> POST /api/v1/sms/simulate'}</span>
                                <span>{'> Processing payload...'}</span>
                            </div>
                        )}

                        {result && (
                            <div className="space-y-4">
                                <div>
                                    <span className="text-muted-foreground block mb-1 text-xs">{'> INTERPRETATION'}</span>
                                    <pre className="bg-background p-3 rounded-md border text-foreground overflow-x-auto text-[13px]">
                                        {JSON.stringify(result.parsedCommand, null, 2)}
                                    </pre>
                                </div>

                                <div>
                                    <span className="text-muted-foreground block mb-1 text-xs">{'> OUTBOUND REPLY'}</span>
                                    <div className="bg-background p-3 rounded-md border text-foreground text-[13px]">
                                        <span className="text-muted-foreground text-xs block mb-2 border-b pb-1">TO: {result.simulatedPhone}</span>
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
