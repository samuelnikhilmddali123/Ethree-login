import React, { useState, useEffect, useRef, useContext } from 'react';
import api from '../services/api';
import { Clock } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const LiveClock = () => {
    const { user, logout } = useContext(AuthContext);
    const [currentTime, setCurrentTime] = useState(null);
    const [workDuration, setWorkDuration] = useState(0); // in seconds
    const syncRef = useRef({
        serverStartTime: null,
        performanceStartTime: null,
        workDurationStart: 0
    });

    useEffect(() => {
        const syncTime = async () => {
            try {
                // 1. Fetch Time
                const timeRes = await api.get('/utils/time');
                const serverTime = new Date(timeRes.data.serverTime);

                syncRef.current.serverStartTime = serverTime.getTime();
                syncRef.current.performanceStartTime = performance.now();

                // 2. Fetch Duration (Only for employees, or if endpoint works)
                const role = user?.role?.toLowerCase();
                if (role === 'employee') {
                    try {
                        const durationRes = await api.get('/attendance/duration');
                        syncRef.current.workDurationStart = (durationRes.data.totalMilliseconds || 0) / 1000;
                    } catch (durErr) {
                        console.warn('Could not fetch work duration:', durErr.message);
                    }
                }

                updateClock();
            } catch (error) {
                console.error('Failed to sync time:', error);
                syncRef.current.serverStartTime = Date.now();
                syncRef.current.performanceStartTime = performance.now();
                updateClock(); // Still start the clock
            }
        };

        const updateClock = () => {
            const elapsedSinceSync = (performance.now() - syncRef.current.performanceStartTime) / 1000; // seconds

            // 1. Update Clock
            let nowInIST = null;
            if (syncRef.current.serverStartTime !== null) {
                nowInIST = new Date(syncRef.current.serverStartTime + (elapsedSinceSync * 1000));
                const options = {
                    timeZone: 'Asia/Kolkata',
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
                };
                setCurrentTime(new Intl.DateTimeFormat('en-IN', options).format(nowInIST));
            }

            // 2. Update Work Duration
            if (nowInIST) {
                const currentDuration = syncRef.current.workDurationStart + elapsedSinceSync;
                setWorkDuration(currentDuration);
            } else {
                const currentDuration = syncRef.current.workDurationStart + elapsedSinceSync;
                setWorkDuration(currentDuration);
            }
        };

        syncTime();
        const interval = setInterval(updateClock, 1000);

        return () => clearInterval(interval);
    }, [user?.role]);

    const formatDuration = (totalSeconds) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        return `${hours}h ${minutes}m ${seconds}s`;
    };

    if (!currentTime) return null;

    const role = user?.role?.toLowerCase();
    const isEmployee = role === 'employee';

    return (
        <div className="flex gap-1.5 md:gap-4">
            {/* Live Clock */}
            <div className="flex items-center gap-1.5 md:gap-3 px-2 py-1 md:px-4 md:py-2 bg-teal-50 border border-teal-100 rounded-lg md:rounded-xl shadow-sm">
                <div className="flex items-center justify-center w-5 h-5 md:w-8 md:h-8 bg-teal-600 rounded md:rounded-lg shadow-inner shrink-0">
                    <Clock className="w-3 h-3 md:w-4 md:h-4 text-white animate-pulse" />
                </div>
                <div className="flex flex-col">
                    <span className="text-[8px] md:text-[10px] font-bold text-teal-400 uppercase tracking-widest leading-none mb-0.5 md:mb-1 whitespace-nowrap">IST Time</span>
                    <span className="text-xs md:text-lg font-black text-teal-900 font-mono leading-none tracking-tighter whitespace-nowrap">
                        {currentTime}
                    </span>
                </div>
            </div>

            {/* Work Duration - Only show for employees */}
            {isEmployee && (
                <div className="flex items-center gap-1.5 md:gap-3 px-2 py-1 md:px-4 md:py-2 bg-green-50 border border-green-200 rounded-lg md:rounded-xl shadow-md shadow-green-100/50">
                    <div className="flex flex-col">
                        <span className="text-[8px] md:text-[10px] font-bold text-green-600 uppercase tracking-widest leading-none mb-0.5 md:mb-1 whitespace-nowrap">Work Duration</span>
                        <span className="text-xs md:text-lg font-black text-green-900 font-mono leading-none tracking-tighter whitespace-nowrap">
                            {formatDuration(workDuration)}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiveClock;
