import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentSsid, setCurrentSsid] = useState(null);
    const [isOnWifi, setIsOnWifi] = useState(true);

    useEffect(() => {
        // --- 1. Instant Session Restoration from LocalStorage ---
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        
        if (storedUser && token) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error('[AUTH] Failed to parse stored user', e);
                localStorage.removeItem('user');
                localStorage.removeItem('token');
            }
        }
        
        // Immediately allow the app to render (either Login or Private routes)
        setLoading(false);

        // --- 2. Native messaging for SSID ---
        const handleMessage = (event) => {
            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                console.log('[AUTH] Native Message Received:', data.type);

                if (data.type === 'WIFI_SSID') {
                    setCurrentSsid(data.ssid);
                    console.log('[AUTH] SSID captured from native:', data.ssid);
                }
            } catch (e) {
                // Not a JSON message or not for us
            }
        };

        window.addEventListener('message', handleMessage);
        document.addEventListener('message', handleMessage);

        // --- 3. Background Session Verification ---
        const verifySession = async () => {
            // Only verify if we actually have a session to verify
            if (!token) return;

            try {
                // This call uses the token from localStorage (via Axios interceptor)
                const response = await api.get('/auth/me');
                if (response.data && response.data.user) {
                    const userData = { ...response.data.user, isRestricted: response.data.isRestricted };
                    setUser(userData);
                    localStorage.setItem('user', JSON.stringify(userData));
                }
            } catch (error) {
                console.warn('[AUTH] Background session verification failed:', error.message);
                
                // Only wipe the session if the server EXPLICITLY rejects the token (401/403)
                // If it's a network error (no response), we keep the local session.
                if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                    console.error('[AUTH] Token invalid, clearing session');
                    setUser(null);
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
                }
            }
        };

        verifySession();

        return () => {
            window.removeEventListener('message', handleMessage);
            document.removeEventListener('message', handleMessage);
        };
    }, []);

    const [socket, setSocket] = useState(null);
    const [heartbeatInterval, setHeartbeatInterval] = useState(null);

    // Heartbeat Presence Tracking
    useEffect(() => {
        // Clear old interval if it exists
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            setHeartbeatInterval(null);
        }

        if (user && user.emp_no && user.role === 'employee') {
            console.log('[PRESENCE] Starting heartbeat for:', user.emp_no);

            const sendHeartbeat = async () => {
                let networkStatus = false;
                try {
                    const netRes = await api.get('/utils/network-check', {
                        params: { wifi_ssid: currentSsid }
                    });
                    networkStatus = netRes.data.is_on_wifi;
                } catch (e) {
                    console.error('[PRESENCE] Network check failed', e);
                    networkStatus = false; // Safe fallback: assume disconnected if check fails
                }

                setIsOnWifi(networkStatus);

                try {
                    await api.post('/utils/heartbeat', { is_on_wifi: networkStatus });
                } catch (e) {
                    console.error('[PRESENCE] Heartbeat failed:', e.message);
                }
            };

            // Send immediate heartbeat on mount
            sendHeartbeat();

            const interval = setInterval(sendHeartbeat, 10000); // 10 seconds

            // Also listen for browser/device coming back online to recover instantly
            window.addEventListener('online', sendHeartbeat);

            setHeartbeatInterval(interval);

            // Cleanup
            return () => {
                console.log('[PRESENCE] Clearing heartbeat interval \u0026 listeners');
                clearInterval(interval);
                window.removeEventListener('online', sendHeartbeat);
            };
        }

        return () => {
            if (heartbeatInterval) {
                console.log('[PRESENCE] Clearing heartbeat interval');
                clearInterval(heartbeatInterval);
            }
        };
    }, [user?.emp_no]); // Only re-run if employee ID changes

    useEffect(() => {
        let newSocket = null;
        if (user && user.emp_no) {
            // Sockets logic can be re-enabled here for local/persistent servers
        }

        return () => {
            if (newSocket) newSocket.disconnect();
        };
    }, [user]);

    const login = async (emp_no, password, face_descriptor = null) => {
        console.log('[AUTH] Attempting login for:', emp_no, face_descriptor ? '(with face)' : '(initial)');
        try {
            const response = await api.post('/auth/login', {
                emp_no,
                password,
                face_descriptor,
                wifi_ssid: currentSsid // Send SSID captured from native layer
            });
            console.log('[AUTH] Login response received:', response.status);
            const { token, user: loggedInUser, isRestricted } = response.data;
            const userData = { ...loggedInUser, isRestricted };

            return {
                success: true,
                role: loggedInUser.role,
                isRestricted,
                user: loggedInUser,
                token: token,
                userData: userData 
            };
        } catch (error) {
            console.error('[AUTH] Login Error Details:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                url: error.config?.url
            });

            // Store data for UI debug display
            window.lastErrorData = error.response?.data;
            return {
                success: false,
                message: error.response?.data?.message || 'Login failed: ' + error.message,
                data: error.response?.data
            };
        }
    };

    const finalizeLogin = (token, userData) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
    };

    const logout = async () => {
        try {
            if (socket) socket.disconnect();

            // Record logout attendance
            if (user && user.role === 'employee') {
                const response = await api.post('/auth/logout');
                const duration = response.data?.duration;
                if (duration) {
                    alert(`Logout successful!\nYou were logged in for: ${duration.formatted}`);
                } else {
                    alert('Logged out successfully');
                }
            } else {
                alert('Logged out successfully');
            }
        } catch (error) {
            console.error('Logout attendance recording failed:', error);
            alert('Logged out successfully');
        } finally {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
            window.location.href = '/login';
        }
    };

    const updateUser = (updatedUserData) => {
        const updatedUser = { ...user, ...updatedUserData };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
    };

    return (
        <AuthContext.Provider value={{ user, loading, isOnWifi, login, finalizeLogin, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
};
