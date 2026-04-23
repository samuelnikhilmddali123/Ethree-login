import React, { useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { Clock, Lock, X, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AttendanceCalendar from '../components/AttendanceCalendar';

const EmployeeDashboard = () => {
    const { user, isOnWifi } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');

    // Attendance states
    const [attendanceHistory, setAttendanceHistory] = useState([]);
    const [firstLogin, setFirstLogin] = useState(null);

    // Fetch first login time 
    useEffect(() => {
        const fetchDurationData = async () => {
            try {
                const res = await api.get('/attendance/duration');
                setFirstLogin(res.data.firstLoginTime);
            } catch (e) {
                console.error('Failed to fetch duration data:', e);
            }
        };
        fetchDurationData();
    }, []);

    // Attendance History Refresh
    useEffect(() => {
        fetchAttendanceHistory();
        const interval = setInterval(fetchAttendanceHistory, 30000); // auto-refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const fetchAttendanceHistory = async () => {
        try {
            const attRes = await api.get('/attendance/history');
            setAttendanceHistory(attRes.data.attendance);
        } catch (error) {
            console.error('Failed to fetch attendance history:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading && attendanceHistory.length === 0) {
        return <div className="flex justify-center p-20"><Clock className="animate-spin text-teal-600" /></div>;
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6 relative">
            <AnimatePresence>
                {!isOnWifi && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-6 text-center"
                    >
                        <WifiOff className="w-20 h-20 text-red-400 mb-6 animate-pulse" />
                        <h2 className="text-3xl font-black text-white mb-4">Network Disconnected</h2>
                        <p className="text-xl text-slate-300 max-w-md">
                            You must be connected to the office WiFi to access the dashboard.
                            <br /><br />
                            Your work session is virtually logged out. Please reconnect to resume automatically.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header Info */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Hello, {user?.name}! 👋</h1>
                    <p className="text-gray-500">Welcome to your dashboard.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setShowPasswordModal(true)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold flex items-center gap-2 hover:bg-gray-200 transition-all"
                    >
                        <Lock className="w-4 h-4" />
                        Change Password
                    </button>
                    <div className="px-4 py-3 bg-teal-50 text-teal-700 rounded-xl font-semibold flex flex-col gap-1 shadow-sm border border-teal-100 min-w-[200px]">
                        <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-teal-400" />
                            <span className="text-[10px] uppercase tracking-wider text-teal-400 font-bold">Today's First Login:</span>
                            <span className="text-xs font-mono">
                                {firstLogin ? new Intl.DateTimeFormat('en-IN', {
                                    timeZone: 'Asia/Kolkata',
                                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
                                }).format(new Date(firstLogin)) : 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Attendance History Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 mb-6">Attendance History</h2>
                <AttendanceCalendar attendanceHistory={attendanceHistory} />
            </div>

            {/* Password Change Modal */}
            <AnimatePresence>
                {showPasswordModal && (
                    <PasswordModal
                        passwordForm={passwordForm}
                        setPasswordForm={setPasswordForm}
                        passwordError={passwordError}
                        setPasswordError={setPasswordError}
                        passwordSuccess={passwordSuccess}
                        setPasswordSuccess={setPasswordSuccess}
                        onClose={() => {
                            setShowPasswordModal(false);
                            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                            setPasswordError('');
                            setPasswordSuccess('');
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

// Password Modal Component
const PasswordModal = ({ passwordForm, setPasswordForm, passwordError, setPasswordError, passwordSuccess, setPasswordSuccess, onClose }) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Lock className="w-6 h-6" />
                        Change Password
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {passwordSuccess && (
                    <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl">{passwordSuccess}</div>
                )}
                {passwordError && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">{passwordError}</div>
                )}

                <form
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setPasswordError('');
                        setPasswordSuccess('');
                        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                            setPasswordError('New passwords do not match');
                            return;
                        }
                        if (passwordForm.newPassword.length < 6) {
                            setPasswordError('Password must be at least 6 characters long');
                            return;
                        }
                        try {
                            await api.put('/auth/password', {
                                currentPassword: passwordForm.currentPassword,
                                newPassword: passwordForm.newPassword
                            });
                            setPasswordSuccess('Password changed successfully!');
                            setTimeout(() => { onClose(); }, 2000);
                        } catch (err) {
                            setPasswordError(err.response?.data?.message || 'Failed to change password');
                        }
                    }}
                    className="space-y-4"
                >
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Current Password</label>
                        <input type="password" required value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" placeholder="Enter current password" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">New Password</label>
                        <input type="password" required value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" placeholder="Minimum 6 characters" minLength={6} />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm New Password</label>
                        <input type="password" required value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" placeholder="Confirm new password" minLength={6} />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-all">Cancel</button>
                        <button type="submit" className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-all">Change Password</button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
};

export default EmployeeDashboard;
