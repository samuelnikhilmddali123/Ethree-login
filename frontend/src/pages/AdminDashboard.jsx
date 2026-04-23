import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
    Users, ClipboardList, LogOut, CheckCircle2, AlertCircle, Wifi, Save, ShieldAlert, Monitor, Trash2
} from 'lucide-react';
import { io } from 'socket.io-client';

const AdminDashboard = () => {
    const [todayReport, setTodayReport] = useState([]);

    const [proxyAttempts, setProxyAttempts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [terminating, setTerminating] = useState(false);

    // Wi-Fi Security State
    const [wifiSsid, setWifiSsid] = useState('');
    const [officeIp, setOfficeIp] = useState('');
    const [myIp, setMyIp] = useState('');
    const [savingWifi, setSavingWifi] = useState(false);

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    const [refreshingStatus, setRefreshingStatus] = useState(false);

    useEffect(() => {
        fetchAll();
        fetchWifiSettings();
        fetchProxyAttempts();

        // Full report fetch every 30 seconds
        const interval = setInterval(fetchAll, 30000);

        // --- Status Updates via Polling ---
        // Polling lightweight endpoint every 5 seconds for status changes.
        const fastPoll = setInterval(fetchQuickStatus, 5000);

        // --- Socket.IO Integration ---
        let socket = null;

        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('[DASHBOARD] Local environment detected, initializing Socket.IO');
            const socketUrl = 'http://localhost:5000';
            socket = io(socketUrl, {
                path: '/socket.io/',
                transports: ['websocket', 'polling']
            });

            socket.on('connect', () => {
                console.log('[DASHBOARD] Socket connected:', socket.id);
            });

            socket.on('employeeStatusUpdate', (data) => {
                console.log('[DASHBOARD] Real-time status update:', data);
                updateEmployeeStatusUI(data.employeeId, data.status);
            });
        }

        return () => {
            clearInterval(interval);
            clearInterval(fastPoll);
            if (socket) socket.disconnect();
        };
    }, []);

    const updateEmployeeStatusUI = (empNo, statusStr) => {
        setTodayReport(prevReport => {
            return prevReport.map(emp => {
                if (emp.emp_no === empNo) {
                    return {
                        ...emp,
                        is_on_wifi: statusStr === 'online'
                    };
                }
                return emp;
            });
        });
    };

    const fetchQuickStatus = async () => {
        try {
            // Lightweight endpoint just returning { emp_no, status }
            const res = await api.get('/admin/employees/status');
            const statuses = res.data;

            setTodayReport(prevReport => {
                let changed = false;
                const newReport = prevReport.map(emp => {
                    const latest = statuses.find(s => s.emp_no === emp.emp_no);
                    if (latest) {
                        const newWifiState = (latest.status === 'online');
                        if (emp.is_on_wifi !== newWifiState) {
                            changed = true;
                            return { ...emp, is_on_wifi: newWifiState };
                        }
                    }
                    return emp;
                });
                return changed ? newReport : prevReport;
            });
        } catch (error) {
            // Silent fail for polling
        }
    };

    const fetchWifiSettings = async () => {
        try {
            const res = await api.get('/admin/settings');
            setWifiSsid(res.data.office_wifi_ssid || '');
            setOfficeIp(res.data.office_public_ip || '');
            setMyIp(res.data.current_ip || '');
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        }
    };

    const handleSaveWifi = async () => {
        if (!wifiSsid.trim() && !officeIp.trim()) {
            alert('At least one security measure (SSID or IP) must be provided.');
            return;
        }
        setSavingWifi(true);
        try {
            await api.post('/admin/settings', {
                office_wifi_ssid: wifiSsid.trim(),
                office_public_ip: officeIp.trim()
            });
            alert('Network security updated successfully.');
        } catch (error) {
            console.error(error);
            alert('Failed to update settings.');
        } finally {
            setSavingWifi(false);
        }
    };

    const fetchProxyAttempts = async () => {
        try {
            const res = await api.get('/admin/proxy-attempts');
            setProxyAttempts(res.data);
        } catch (error) {
            console.error('Failed to fetch proxy attempts:', error);
        }
    };

    const handleDeleteProxyAttempt = async (id) => {
        if (!window.confirm('Delete this log entry?')) return;
        try {
            await api.delete(`/admin/proxy-attempts/${id}`);
            setProxyAttempts(prev => prev.filter(a => a._id !== id));
        } catch (error) {
            alert('Failed to delete log entry');
        }
    };

    const handleClearAllProxyAttempts = async () => {
        if (!window.confirm('Are you sure you want to CLEAR ALL proxy history? This cannot be undone.')) return;
        try {
            await api.delete('/admin/proxy-attempts');
            setProxyAttempts([]);
        } catch (error) {
            alert('Failed to clear history');
        }
    };

    const fetchAll = async () => {
        try {
            const repRes = await api.get(`/admin/reports/daily?date=${today}`);
            setTodayReport(repRes.data);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleForceLogoutAll = async () => {
        if (!window.confirm("Are you sure you want to end ALL active employee sessions?")) return;
        setTerminating(true);
        try {
            const response = await api.post('/admin/force-logout-all');
            alert(response.data.message);
            await fetchAll();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to terminate sessions');
        } finally {
            setTerminating(false);
        }
    };

    const handleForceLogoutEmployee = async (emp_no) => {
        if (!window.confirm(`End session for employee #${emp_no}?`)) return;
        try {
            await api.post(`/admin/force-logout/${emp_no}`);
            await fetchAll();
        } catch (error) {
            alert('Failed to terminate session');
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-400">Loading Dashboard...</div>;

    // Filter for Active online sessions
    const activeNowList = todayReport.filter(r => r.login_time !== 'N/A' && r.logout_time === 'N/A' && r.is_on_wifi !== false);
    const activeNow = activeNowList.length;
    const presentToday = todayReport.filter(r => r.login_time !== 'N/A').length;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Total Employees" value={todayReport.length} icon={Users} color="bg-slate-800" />
                <StatCard title="Present Today" value={presentToday} icon={CheckCircle2} color="bg-teal-600" />
                <StatCard title="Active Now" value={activeNow} icon={LogOut} color="bg-rose-600" />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex gap-4 items-center">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                            <Wifi className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Office Wi-Fi SSID</h3>
                            <p className="text-xs text-gray-400 mt-0.5">Restriction for **Mobile App** (Native SSID detection).</p>
                        </div>
                    </div>
                    <div className="w-full md:w-auto flex items-center gap-3">
                            <input
                                type="text"
                                value={wifiSsid}
                                onChange={(e) => setWifiSsid(e.target.value)}
                                placeholder="e.g. Ethree_5G"
                                className="flex-1 md:w-64 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium"
                            />
                    </div>
                </div>

                <div className="h-px bg-gray-50"></div>

                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex gap-4 items-center">
                        <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center shrink-0">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Office Public IP</h3>
                            <p className="text-xs text-gray-400 mt-0.5">Restriction for **Web Browsers** (cannot see SSID).</p>
                        </div>
                    </div>
                    <div className="w-full md:w-auto flex flex-col md:flex-row items-start md:items-center gap-3">
                        <div className="flex flex-col gap-1">
                            <input
                                type="text"
                                value={officeIp}
                                onChange={(e) => setOfficeIp(e.target.value)}
                                placeholder="Auto-Fill below or type IP"
                                className="flex-1 md:w-64 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-sm font-medium"
                            />
                            {myIp && (
                                <button
                                    onClick={() => setOfficeIp(myIp)}
                                    className="text-[10px] text-teal-600 font-bold hover:underline ml-1"
                                >
                                    Current Office IP: {myIp} (Click to set)
                                </button>
                            )}
                        </div>
                        <button
                            onClick={handleSaveWifi}
                            disabled={savingWifi}
                            className="w-full md:w-auto px-6 py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {savingWifi ? 'Saving...' : 'Save All Security Settings'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <ClipboardList className="w-5 h-5 text-teal-600" />
                            Attendance Overview
                            <span className="text-sm font-normal text-gray-400 ml-1">({today})</span>
                        </h3>
                    </div>
                    <button
                        onClick={handleForceLogoutAll}
                        disabled={terminating || activeNow === 0}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${terminating || activeNow === 0
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100'
                            }`}
                    >
                        End All Sessions
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-100">
                                {['Employee', 'Login', 'Logout', 'Status', 'Actions'].map(h => (
                                    <th key={h} className="pb-3 px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {todayReport.map((r, i) => {
                                const isActive = r.login_time !== 'N/A' && r.logout_time === 'N/A';
                                const isDisconnected = isActive && r.is_on_wifi === false;
                                const isAbsent = r.login_time === 'N/A';
                                return (
                                    <tr key={i} className={`hover:bg-gray-50 transition-colors ${isAbsent ? 'opacity-50' : ''}`}>
                                        <td className="py-3 px-2">
                                            <div className="flex items-center gap-3">
                                                {r.profile_picture ? (
                                                    <img src={r.profile_picture} alt={r.name} className="w-8 h-8 rounded-lg shrink-0 object-cover" />
                                                ) : (
                                                    <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center text-teal-700 font-bold text-xs shrink-0">
                                                        {r.name?.charAt(0)}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-semibold text-gray-800 text-sm">{r.full_name || r.name}</p>
                                                    <p className="text-[10px] text-gray-400">#{r.emp_no}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-2 text-sm text-gray-600">{r.login_time}</td>
                                        <td className="py-3 px-2 text-sm text-gray-600">{r.logout_time === 'N/A' && r.login_time !== 'N/A' ? 'Active' : r.logout_time}</td>
                                        <td className="py-3 px-2">
                                            {isAbsent ? (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-gray-100 text-gray-400">Absent</span>
                                            ) : isDisconnected ? (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-amber-100 text-amber-700">Disconnected</span>
                                            ) : isActive ? (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-teal-100 text-teal-700">Online</span>
                                            ) : (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-blue-100 text-blue-700">Completed</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-2">
                                            {isActive && (
                                                <button
                                                    onClick={() => handleForceLogoutEmployee(r.emp_no)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Force Logout"
                                                >
                                                    <LogOut className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {todayReport.length === 0 && (
                    <div className="text-center py-10 text-gray-400 flex flex-col items-center gap-2">
                        <AlertCircle className="w-10 h-10 opacity-20" />
                        <p>No employee records found</p>
                    </div>
                )}
            </div>
            {/* Proxy Attempts Section */}
            <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden">
                <div className="p-6 bg-rose-50/50 border-b border-rose-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-rose-800 flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5" />
                            Security Alert: Proxy Login Attempts
                        </h3>
                        <p className="text-xs text-rose-600 font-medium">System flagged these as face mismatches</p>
                    </div>
                    {proxyAttempts.length > 0 && (
                        <button
                            onClick={handleClearAllProxyAttempts}
                            className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-rose-100 transition-all shadow-sm"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Clear All History
                        </button>
                    )}
                </div>
                <div className="p-6">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    {['Captured Image', 'Login Attempt By', 'Person Detected', 'Device / IP', 'Time', 'Actions'].map(h => (
                                        <th key={h} className="pb-3 px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {proxyAttempts.map((attempt) => (
                                    <tr key={attempt._id} className="hover:bg-rose-50/30 transition-colors">
                                        <td className="py-3 px-2">
                                            <div className="w-16 h-12 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                                                <img
                                                    src={attempt.image_data}
                                                    alt="Captured"
                                                    className="w-full h-full object-cover cursor-zoom-in hover:scale-110 transition-transform"
                                                    onClick={() => window.open().document.write(`<img src="${attempt.image_data}" />`)}
                                                />
                                            </div>
                                        </td>
                                        <td className="py-3 px-2">
                                            <p className="font-semibold text-gray-800 text-sm">{attempt.login_employee_name}</p>
                                            <p className="text-[10px] text-gray-400 font-mono">ID: {attempt.login_employee_id}</p>
                                        </td>
                                        <td className="py-3 px-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${attempt.detected_face_employee_id === 'Unknown Face' ? 'bg-gray-100 text-gray-500' : 'bg-rose-100 text-rose-700'}`}>
                                                    {attempt.detected_employee_name}
                                                </div>
                                            </div>
                                            {attempt.detected_face_employee_id !== 'Unknown Face' && (
                                                <p className="text-[10px] text-gray-400 font-mono mt-1">ID: {attempt.detected_face_employee_id}</p>
                                            )}
                                        </td>
                                        <td className="py-3 px-2">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1 text-xs text-gray-600">
                                                    <Monitor className="w-3 h-3" />
                                                    <span className="truncate max-w-[150px]" title={attempt.device_info}>
                                                        {attempt.device_info.includes('Windows') ? 'Windows PC' :
                                                            attempt.device_info.includes('Android') ? 'Android Device' :
                                                                attempt.device_info.includes('iPhone') ? 'iPhone' : 'Mobile/Web'}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-gray-400 font-mono italic">{attempt.ip_address}</p>
                                            </div>
                                        </td>
                                        <td className="py-3 px-2 text-xs text-gray-500">
                                            {new Intl.DateTimeFormat('en-IN', {
                                                timeZone: 'Asia/Kolkata',
                                                dateStyle: 'short',
                                                timeStyle: 'short'
                                            }).format(new Date(attempt.timestamp))}
                                        </td>
                                        <td className="py-3 px-2">
                                            <button
                                                onClick={() => handleDeleteProxyAttempt(attempt._id)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                title="Delete Log"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {proxyAttempts.length === 0 && (
                            <div className="text-center py-10 text-slate-300">
                                <p className="text-sm font-medium">No proxy attempts detected</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-5 hover:shadow-xl hover:shadow-teal-900/5 transition-all group">
        <div className={`w-14 h-14 ${color} text-white rounded-2xl flex items-center justify-center shadow-lg shadow-${color.split('-')[1]}-200/50 group-hover:scale-110 transition-transform`}>
            <Icon className="w-7 h-7" />
        </div>
        <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{title}</p>
            <h4 className="text-3xl font-black text-slate-800 tracking-tight">{value}</h4>
        </div>
    </div>
);

export default AdminDashboard;
