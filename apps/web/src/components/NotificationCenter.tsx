import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';

interface Notification {
    id: string;
    message: string;
    read: boolean;
    createdAt: string;
}

export function NotificationCenter() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.filter((n) => !n.read).length;

    useEffect(() => {
        // Attempt to connect to a real-time WebSocket backend for notifications
        // Using a generic URL that would be replaced by the actual environment config
        const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3004/notifications';
        let socket: WebSocket | null = null;
        let mockInterval: ReturnType<typeof setInterval>;

        const connectWebSocket = () => {
            try {
                socket = new WebSocket(wsUrl);

                socket.onopen = () => {
                    console.log('[NotificationCenter] WebSocket Connected');
                };

                socket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'NEW_NOTIFICATION') {
                            setNotifications((prev) => [data.payload, ...prev]);
                        }
                    } catch (e) {
                        console.error('Failed to parse WebSocket message', e);
                    }
                };

                socket.onclose = () => {
                    console.log('[NotificationCenter] WebSocket Disconnected. Reconnecting in 5s...');
                    setTimeout(connectWebSocket, 5000);
                };
            } catch (err) {
                console.warn('WebSocket connection failed, falling back to mock polling', err);
                // Fallback mock for demonstration if WebSocket server isn't running
                mockInterval = setInterval(() => {
                    const newNotif: Notification = {
                        id: crypto.randomUUID(),
                        message: 'Mock: New High Risk Alert generated',
                        read: false,
                        createdAt: new Date().toISOString()
                    };
                    setNotifications((prev) => [newNotif, ...prev]);
                }, 30000); // Mock a notification every 30 seconds
            }
        };

        connectWebSocket();

        // Close dropdown on outside click
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            if (socket) socket.close();
            if (mockInterval) clearInterval(mockInterval);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
        if (!isOpen && unreadCount > 0) {
            // Mark all as read when opening
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        }
    };

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            <button
                onClick={toggleDropdown}
                className="relative p-2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                aria-label="Notifications"
            >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 inline-flex items-center justify-center w-3.5 h-3.5 text-[9px] font-bold text-destructive-foreground bg-destructive rounded border border-card">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-popover rounded-md border border-border shadow-md z-50 overflow-hidden transform origin-top-right transition-all duration-200 ease-out">
                    <div className="p-3 border-b border-border bg-muted/30 flex justify-between items-center">
                        <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                        {notifications.length > 0 && (
                            <button
                                onClick={() => setNotifications([])}
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Clear all
                            </button>
                        )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-muted-foreground">
                                <Bell className="w-6 h-6 mx-auto mb-2 opacity-50" />
                                <p className="text-xs">No new notifications</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-border">
                                {notifications.map((notif) => (
                                    <li
                                        key={notif.id}
                                        className="p-3 hover:bg-muted/50 transition-colors text-sm text-foreground"
                                    >
                                        <p className="font-medium text-sm leading-snug">{notif.message}</p>
                                        <p className="text-[11px] text-muted-foreground mt-1.5">
                                            {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
