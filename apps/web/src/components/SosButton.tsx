import { useState, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface SosButtonProps {
    patientId: string;
    onSosTriggered?: () => void;
}

export function SosButton({ patientId, onSosTriggered }: SosButtonProps) {
    const [isHolding, setIsHolding] = useState(false);
    const [progress, setProgress] = useState(0);
    const [showModal, setShowModal] = useState(false);
    const [status, setStatus] = useState<'IDLE' | 'FIRING' | 'SUCCESS' | 'ERROR'>('IDLE');

    const holdDuration = 3000; // 3 seconds
    const intervalMs = 50;
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const clearHold = () => {
        setIsHolding(false);
        setProgress(0);
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const startHold = () => {
        if (status === 'FIRING' || status === 'SUCCESS') return;
        setIsHolding(true);
        setProgress(0);

        // Safety clear
        if (timerRef.current) clearInterval(timerRef.current);

        timerRef.current = setInterval(() => {
            setProgress((prev) => {
                const next = prev + (intervalMs / holdDuration) * 100;
                if (next >= 100) {
                    clearInterval(timerRef.current!);
                    triggerSosAsync();
                    return 100;
                }
                return next;
            });
        }, intervalMs);
    };

    const triggerSosAsync = async () => {
        clearHold();
        setShowModal(true);
        setStatus('FIRING');

        try {
            // API call to the emergency SOS endpoint
            const res = await fetch(`/patients/${patientId}/sos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}` // Placeholder auth
                },
                body: JSON.stringify({
                    patientPhone: '+254700000000', // Typically fetched from ctx
                    chvPhone: '+254700000001'
                })
            });

            if (!res.ok) throw new Error('API request failed');

            setStatus('SUCCESS');
            if (onSosTriggered) onSosTriggered();

            // Auto close success modal after 5 seconds
            setTimeout(() => {
                setShowModal(false);
                setStatus('IDLE');
            }, 5000);

        } catch (err) {
            console.error('Failed to trigger SOS', err);
            setStatus('ERROR');
        }
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    return (
        <>
            <div className="relative inline-block">
                {/* Progress Background - Normalized */}
                <div
                    className="absolute inset-0 bg-destructive/10 rounded-md transition-all ease-linear"
                    style={{
                        width: `${Math.min(progress, 100)}%`,
                        opacity: isHolding ? 1 : 0,
                        transitionDuration: isHolding ? `${intervalMs}ms` : '300ms'
                    }}
                />

                <button
                    onMouseDown={startHold}
                    onMouseUp={clearHold}
                    onMouseLeave={clearHold}
                    onTouchStart={startHold}
                    onTouchEnd={clearHold}
                    onContextMenu={(e) => { e.preventDefault(); return false; }}
                    aria-label={isHolding ? `Hold to trigger SOS, ${Math.ceil(3 - (progress / 100) * 3)} seconds remaining` : 'Hold to trigger emergency SOS'}
                    aria-live="assertive"
                    className={`
            relative flex items-center justify-center px-4 py-2 font-medium text-sm
            rounded-md select-none overflow-hidden transition-all duration-200 border
            ${isHolding ? 'bg-transparent border-destructive text-destructive' : 'bg-destructive text-destructive-foreground border-transparent hover:bg-destructive/90'}
            focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
          `}
                >
                    <AlertCircle className="w-4 h-4 mr-2" aria-hidden="true" />
                    <span>{isHolding ? `Holding... ${Math.ceil(3 - (progress / 100) * 3)}s` : 'Trigger SOS'}</span>
                </button>
            </div>

            {/* Confirmation Modal - Normalized */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-label="SOS Status">
                    <div className="bg-card border border-border shadow-md rounded-md p-6 max-w-sm w-full text-center mx-4">
                        {status === 'FIRING' && (
                            <div className="flex flex-col items-center">
                                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                                <h2 className="text-lg font-semibold text-foreground mb-1">Initiating SOS</h2>
                                <p className="text-sm text-muted-foreground">Contacting emergency services.</p>
                            </div>
                        )}

                        {status === 'SUCCESS' && (
                            <div className="flex flex-col items-center text-foreground">
                                <CheckCircle2 className="w-10 h-10 mb-4 text-green-600 dark:text-green-500" />
                                <h2 className="text-lg font-semibold mb-1">SOS Dispatched</h2>
                                <p className="text-sm text-muted-foreground mb-6">Help is on the way.</p>
                                <button
                                    onClick={() => {
                                        setShowModal(false);
                                        setStatus('IDLE');
                                    }}
                                    className="w-full py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium rounded-md transition-colors text-sm"
                                >
                                    Close
                                </button>
                            </div>
                        )}

                        {status === 'ERROR' && (
                            <div className="flex flex-col items-center text-foreground" role="alert">
                                <AlertCircle className="w-10 h-10 mb-4 text-destructive" />
                                <h2 className="text-lg font-semibold mb-1">SOS Failed</h2>
                                <p className="text-sm text-muted-foreground mb-6">Network error occurred. Try again.</p>
                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium rounded-md transition-colors text-sm"
                                    >
                                        Dismiss
                                    </button>
                                    <button
                                        onClick={triggerSosAsync}
                                        className="flex-1 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium rounded-md transition-colors text-sm"
                                    >
                                        Retry
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
