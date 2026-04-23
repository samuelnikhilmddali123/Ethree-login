import React, { useState } from 'react';
import {
    Clock, Calendar as CalendarIcon, ChevronLeft, ChevronRight
} from 'lucide-react';
import {
    format, startOfMonth, endOfMonth, startOfWeek,
    endOfWeek, eachDayOfInterval, isSameDay,
    isSameMonth, addMonths, subMonths, isToday
} from 'date-fns';

const AttendanceCalendar = ({ attendanceHistory = [] }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Calendar logic
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    // Helper to parse YYYY-MM-DD as local date (not UTC)
    const parseLocalDate = (dateStr) => {
        if (!dateStr) return new Date();
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    };

    const getAttendanceForDay = (day) => {
        return attendanceHistory.filter(record =>
            isSameDay(parseLocalDate(record.date), day)
        );
    };

    const dayAttendance = getAttendanceForDay(selectedDate);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar View */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-teal-600" />
                        {format(currentMonth, 'MMMM yyyy')}
                    </h3>
                    <div className="flex gap-1">
                        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button onClick={() => setCurrentMonth(new Date())} className="px-3 text-sm font-semibold hover:bg-gray-100 rounded-lg transition-all">
                            Today
                        </button>
                        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-4">
                    <div className="grid grid-cols-7 mb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="text-center text-xs font-bold text-gray-400 uppercase py-2">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {calendarDays.map((day, idx) => {
                            const attendanceRecords = getAttendanceForDay(day);

                            // Calculate total duration for the day using interval merging
                            let totalMs = 0;
                            if (attendanceRecords.length > 0) {
                                const now = new Date();
                                const isDayToday = isSameDay(now, day);

                                const intervals = attendanceRecords.map(r => ({
                                    start: new Date(r.login_time).getTime(),
                                    end: r.logout_time ? new Date(r.logout_time).getTime() :
                                        (isDayToday ? now.getTime() : new Date(r.login_time).getTime())
                                })).filter(i => !isNaN(i.start) && !isNaN(i.end));

                                if (intervals.length > 0) {
                                    intervals.sort((a, b) => a.start - b.start);
                                    const merged = [];
                                    let current = intervals[0];

                                    for (let i = 1; i < intervals.length; i++) {
                                        const next = intervals[i];
                                        if (next.start <= current.end) {
                                            current.end = Math.max(current.end, next.end);
                                        } else {
                                            merged.push(current);
                                            current = next;
                                        }
                                    }
                                    merged.push(current);
                                    totalMs = merged.reduce((acc, i) => acc + (i.end - i.start), 0);
                                }
                            }

                            const hours = Math.floor(totalMs / 3600000);
                            const minutes = Math.floor((totalMs % 3600000) / 60000);
                            const durationString = totalMs > 0 ? `${hours}h ${minutes}m` : null;

                            const isTodayDay = isSameDay(day, new Date());
                            const isSelected = isSameDay(day, selectedDate);
                            const isCurrentMonth = isSameMonth(day, monthStart);
                            const isHalfDay = totalMs > 0 && totalMs < 5 * 3600000;

                            return (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedDate(day)}
                                    className={`
                                        relative h-14 rounded-xl flex flex-col items-center justify-center transition-all
                                        ${!isCurrentMonth ? 'text-gray-300' : ''}
                                        ${isSelected ? 'bg-teal-600 shadow-md scale-105 z-10 text-white' : 'hover:bg-teal-50'}
                                        ${isToday(day) && !isSelected ? 'border-2 border-teal-200' : ''}
                                    `}
                                >
                                    <span className={`text-sm font-medium ${isSelected ? 'text-white' : isTodayDay ? 'text-teal-600' : 'text-gray-700'}`}>
                                        {format(day, 'd')}
                                    </span>
                                    {attendanceRecords.length > 0 && (
                                        <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-teal-300' : 'bg-green-500'}`} />
                                    )}
                                    {durationString && (
                                        <div className="flex flex-col items-center leading-none">
                                            <span className={`text-[9px] font-bold ${isSelected ? 'text-teal-100' : 'text-gray-400'}`}>
                                                {durationString}
                                            </span>
                                            {isHalfDay && (
                                                <span className={`text-[7px] font-black uppercase tracking-tighter ${isSelected ? 'text-white' : 'text-amber-600'}`}>
                                                    Half Day
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Day Details */}
            <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-teal-600" />
                            Details: {format(selectedDate, 'MMMM d, yyyy')}
                        </h3>
                    </div>

                    <div className="space-y-6">
                        {/* Attendance Section */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Attendance Sessions</h4>
                            {dayAttendance.length > 0 ? (
                                dayAttendance.map((record, idx) => {
                                    const loginTime = new Date(record.login_time);
                                    const logoutTime = record.logout_time ? new Date(record.logout_time) : null;

                                    // Calculate Disconnected Intervals from wifi_history
                                    const history = record.wifi_history || [];
                                    const disconnections = [];
                                    let totalDisconnectedMs = 0;

                                    for (let i = 0; i < history.length; i++) {
                                        if (history[i].status === 'Disconnected') {
                                            const start = new Date(history[i].timestamp);
                                            // Find the next 'Connected' entry or use logout/now
                                            const nextEntry = history.slice(i + 1).find(e => e.status === 'Connected');
                                            const end = nextEntry ? new Date(nextEntry.timestamp) : (logoutTime || new Date());

                                            const diff = end - start;
                                            if (diff > 0) {
                                                disconnections.push({
                                                    start,
                                                    end,
                                                    durationFormatted: diff < 60000 ? `${Math.round(diff / 1000)}s` : `${Math.floor(diff / 60000)}m ${Math.floor((diff % 60000) / 1000)}s`
                                                });
                                                totalDisconnectedMs += diff;
                                            }
                                        }
                                    }

                                    const totalDisconnectedFormatted = totalDisconnectedMs < 60000 ?
                                        `${Math.round(totalDisconnectedMs / 1000)}s` :
                                        `${Math.floor(totalDisconnectedMs / 3600000)}h ${Math.floor((totalDisconnectedMs % 3600000) / 60000)}m`;

                                    return (
                                        <div key={idx} className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-gray-500 font-medium">Login</span>
                                                <span className="font-bold text-teal-600">
                                                    {!isNaN(loginTime.getTime()) ? format(loginTime, 'hh:mm a') : 'N/A'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-gray-500 font-medium">Logout</span>
                                                <div className="text-right">
                                                    <span className={`font-bold ${record.session_status === 'Active' ? 'text-green-600' :
                                                        record.session_status === 'Forced Logout' ? 'text-red-500' :
                                                            'text-purple-600'
                                                        }`}>
                                                        {logoutTime && !isNaN(logoutTime.getTime()) ? format(logoutTime, 'hh:mm a') : 'Active Session'}
                                                    </span>
                                                    {record.session_status === 'Forced Logout' && (
                                                        <span className="block text-[10px] text-red-400 font-medium mt-0.5">
                                                            (Forced Logout)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Wi-Fi Disconnection Alert */}
                                            {disconnections.length > 0 && (
                                                <div className="mt-2 pt-2 border-t border-dashed border-gray-200">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1">
                                                            <AlertCircle className="w-3 h-3" />
                                                            Wi-Fi Disconnections
                                                        </span>
                                                        <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                                            Total: {totalDisconnectedFormatted}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {disconnections.map((d, dIdx) => (
                                                            <div key={dIdx} className="flex justify-between text-[9px] text-gray-500 font-medium bg-white/50 p-1.5 rounded-lg border border-gray-100">
                                                                <span>{format(d.start, 'hh:mm:ss a')} - {format(d.end, 'hh:mm:ss a')}</span>
                                                                <span className="font-bold text-amber-600">({d.durationFormatted})</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {record.logout_reason && (
                                                <div className="text-[10px] text-red-600 bg-red-50 p-2 rounded mt-1 border border-red-100">
                                                    Reason: {record.logout_reason}
                                                </div>
                                            )}
                                            {record.duration && (
                                                <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-gray-400">DURATION</span>
                                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold">
                                                        {record.duration}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-xs text-gray-400 italic py-2">No attendance records.</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-teal-600 to-emerald-700 rounded-2xl shadow-md p-6 text-white">
                    <h4 className="font-bold text-teal-100 text-sm uppercase tracking-wider mb-2">Month Summary</h4>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <div className="text-2xl font-bold">
                                {attendanceHistory.filter(r => isSameMonth(parseLocalDate(r.date), currentMonth)).length}
                            </div>
                            <p className="text-teal-100 text-[10px] uppercase font-bold tracking-tight">Total Sessions</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AttendanceCalendar;
