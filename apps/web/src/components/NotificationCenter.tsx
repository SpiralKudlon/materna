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
                className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors focus:outline-none"
                aria-label="Notifications"
            >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full border-2 border-white animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden transform origin-top-right transition-all duration-200 ease-out">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-800">Notifications</h3>
                        {notifications.length > 0 && (
                            <button
                                onClick={() => setNotifications([])}
                                className="text-xs text-blue-600 hover:underline"
                            >
                                Clear all
                            </button>
                        )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-gray-500">
                                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                <p className="text-sm">No new notifications</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-50">
                                {notifications.map((notif) => (
                                    <li
                                        key={notif.id}
                                        className="p-4 hover:bg-gray-50 transition-colors text-sm text-gray-700"
                                    >
                                        <p className="font-medium">{notif.message}</p>
                                        <p className="text-xs text-gray-400 mt-1">
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
