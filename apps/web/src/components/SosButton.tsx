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
            <div className="relative inline-block shadow-lg rounded-full">
                {/* Progress Background */}
                <div
                    className="absolute inset-0 bg-red-700 rounded-full transition-all ease-linear"
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
                    // Prevent default context menu on long press for mobile
                    onContextMenu={(e) => { e.preventDefault(); return false; }}
                    className={`
            relative flex items-center justify-center px-8 py-4 font-bold text-white uppercase tracking-wider
            rounded-full select-none overflow-hidden transition-all duration-200
            ${isHolding ? 'scale-95 bg-transparent' : 'bg-red-600 hover:bg-red-500'}
            focus:outline-none focus:ring-4 focus:ring-red-300
          `}
                >
                    <AlertCircle className="w-6 h-6 mr-2" />
                    <span>{isHolding ? `HOLD TO CONFIRM... ${Math.ceil(3 - (progress / 100) * 3)}s` : 'EMERGENCY SOS'}</span>
                </button>
            </div>

            {/* Confirmation Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center mx-4 transform animate-in zoom-in-95">
                        {status === 'FIRING' && (
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
                                <h2 className="text-xl font-bold text-gray-900 mb-2">Initiating SOS...</h2>
                                <p className="text-gray-500">Contacting emergency services and CHV.</p>
                            </div>
                        )}

                        {status === 'SUCCESS' && (
                            <div className="flex flex-col items-center text-green-600">
                                <CheckCircle2 className="w-20 h-20 mb-4 animate-bounce" />
                                <h2 className="text-2xl font-bold mb-2">SOS Sent Successfully</h2>
                                <p className="text-gray-600 mb-6">Help is on the way. Please stay calm and keep your phone nearby.</p>
                                <button
                                    onClick={() => {
                                        setShowModal(false);
                                        setStatus('IDLE');
                                    }}
                                    className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-xl transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        )}

                        {status === 'ERROR' && (
                            <div className="flex flex-col items-center text-red-600">
                                <AlertCircle className="w-20 h-20 mb-4" />
                                <h2 className="text-2xl font-bold mb-2">Failed to send SOS</h2>
                                <p className="text-gray-600 mb-6">There was a network error. Please try again immediately or call your CHV directly.</p>
                                <div className="flex gap-4 w-full">
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={triggerSosAsync}
                                        className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
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
