import React, { useContext } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LayoutDashboard, Users, LogOut, Moon, Sun, Bell, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import LiveClock from './LiveClock';

const LogoutModal = ({ isOpen, onClose, onConfirm, user }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-3xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden"
            >
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-teal-50 to-blue-50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Ready to Clock Out?</h3>
                        <p className="text-sm text-gray-500">Confirm your logout to end your session</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors text-gray-400">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 border-t border-gray-100 flex gap-4 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-6 rounded-2xl font-bold text-gray-600 hover:bg-white border border-gray-200 transition-all"
                    >
                        Keep Working
                    </button>
                    <button
                        onClick={() => onConfirm(null)}
                        className="flex-1 py-3 px-6 rounded-2xl font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200 transition-all flex items-center justify-center gap-2"
                    >
                        <LogOut className="w-5 h-5" />
                        Confirm Logout
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

const DashboardLayout = () => {
    const { user, logout } = useContext(AuthContext);
    const location = useLocation();
    const [isLogoutModalOpen, setIsLogoutModalOpen] = React.useState(false);

    // Auto-logout monitor for midnight IST
    React.useEffect(() => {
        const checkMidnight = () => {
            const now = new Date();
            const istOptions = { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false };
            const istStr = new Intl.DateTimeFormat('en-US', istOptions).format(now);
            const [hours, minutes, seconds] = istStr.split(':').map(Number);

            if (hours === 0 && minutes === 0 && seconds < 10) {
                window.location.reload();
            }
        };

        const interval = setInterval(checkMidnight, 5000);
        return () => clearInterval(interval);
    }, []);

    const navItems = user?.role === 'admin' ? [
        { name: 'Overview', path: '/admin', icon: LayoutDashboard },
        { name: 'Employees', path: '/admin/employees', icon: Users },
    ] : [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    ];

    const handleLogoutClick = () => {
        if (user?.role === 'employee') {
            setIsLogoutModalOpen(true);
        } else {
            logout();
        }
    };

    const handleConfirmLogout = () => {
        logout();
        setIsLogoutModalOpen(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
            {/* Sidebar - Desktop */}
            <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col">
                <div className="p-6 h-20 flex items-center border-b border-gray-100">
                    <img src="/logo.jpg" alt="ETHREE Logo" className="h-10 w-10 object-contain rounded-xl shadow-sm mr-3" />
                    <span className="text-xl font-black tracking-tighter text-gray-900">ETHREE</span>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <div className="text-xs font-semibold text-gray-400 uppercase px-3 mb-2 tracking-wider">Main Menu</div>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive
                                    ? 'bg-teal-50 text-teal-700 shadow-sm'
                                    : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <Icon className={`w-5 h-5 ${isActive ? 'text-teal-600' : 'text-gray-400'}`} />
                                <span className="font-medium">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <button
                        onClick={handleLogoutClick}
                        className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header */}
                <header className="h-16 md:h-20 bg-white border-b border-gray-200 flex items-center justify-between px-2 md:px-6 sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center md:hidden gap-1.5 shrink-0">
                        <img src="/logo.jpg" alt="ETHREE Logo" className="h-8 w-8 object-contain rounded-lg shadow-sm shrink-0" />
                        <span className="text-sm font-black tracking-tighter text-gray-900">ETHREE</span>
                    </div>
                    <div className="hidden md:block">
                        <h2 className="text-xl font-bold text-gray-800">
                            {navItems.find(item => item.path === location.pathname)?.name || 'Dashboard'}
                        </h2>
                    </div>

                    <div className="flex items-center gap-1.5 md:gap-6">
                        <LiveClock />
                        <div className="flex items-center gap-1 md:gap-4">
                            <button className="p-1 md:p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors relative">
                                <Bell className="w-5 h-5 md:w-6 md:h-6" />
                                <span className="absolute top-1.5 md:top-2 right-1.5 md:right-2 w-1.5 h-1.5 bg-red-500 rounded-full border-2 border-white"></span>
                            </button>
                            <div className="h-6 w-px bg-gray-200 mx-1 md:mx-2"></div>
                            <div className="flex items-center gap-2 md:gap-3">
                                <div className="text-right hidden sm:block">
                                    <p className="text-xs md:text-sm font-bold text-gray-800">{user?.full_name || user?.name}</p>
                                    <p className="text-[10px] md:text-xs text-gray-500 capitalize">{user?.role}</p>
                                </div>
                                {user?.profile_picture ? (
                                    <img
                                        src={user.profile_picture}
                                        alt={user.name}
                                        className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-teal-200 object-cover shadow-sm"
                                    />
                                ) : (
                                    <div className="w-8 h-8 md:w-10 md:h-10 bg-teal-100 border-2 border-teal-200 rounded-full flex items-center justify-center text-teal-600 text-xs md:text-base font-bold shadow-inner">
                                        {(user?.full_name || user?.name)?.charAt(0)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
                    <Outlet />
                </div>
            </main>

            {/* Mobile Navbar */}
            <div className="md:hidden bg-white border-t border-gray-200 px-6 py-2 flex items-center justify-around h-16 sticky bottom-0 z-10 shadow-lg">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex flex-col items-center justify-center ${isActive ? 'text-teal-600' : 'text-gray-400'}`}
                        >
                            <Icon className="w-6 h-6" />
                            <span className="text-[10px] mt-1 font-bold">{item.name}</span>
                        </Link>
                    );
                })}
                <button onClick={handleLogoutClick} className="flex flex-col items-center justify-center text-red-400">
                    <LogOut className="w-6 h-6" />
                    <span className="text-[10px] mt-1 font-bold">Logout</span>
                </button>
            </div>

            <LogoutModal
                isOpen={isLogoutModalOpen}
                onClose={() => setIsLogoutModalOpen(false)}
                onConfirm={handleConfirmLogout}
                user={user}
            />
        </div>
    );
};

export default DashboardLayout;
