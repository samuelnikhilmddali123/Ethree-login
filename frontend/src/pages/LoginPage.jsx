import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LogIn, User, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FaceCapture from '../components/FaceCapture';
import api from '../services/api';

const LoginPage = () => {
    const [empNo, setEmpNo] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const { login, finalizeLogin, user, loading } = useContext(AuthContext);
    const [faceVerifyData, setFaceVerifyData] = useState(null);
    const [loginResult, setLoginResult] = useState(null);
    const [pendingLoginTokens, setPendingLoginTokens] = useState(null);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const reason = searchParams.get('reason');
        if (reason === 'concurrent_login') {
            setError('Your account has been logged in from another device.');
        }

        // --- AUTO-REDIRECT IF ALREADY LOGGED IN (Persistent Session) ---
        if (!loading && user) {
            console.log('[AUTH] Already logged in, redirecting...');
            if (user.role === 'admin') {
                navigate('/admin', { replace: true });
            } else if (user.isRestricted) {
                navigate('/restricted-access', { replace: true });
            } else {
                navigate('/dashboard', { replace: true });
            }
        }
    }, [searchParams, user, loading, navigate]);


    const handleLoginSuccess = (result, tokens = null) => {
        if (tokens) {
            finalizeLogin(tokens.token, tokens.userData);
        }

        if (result.user?.role === 'admin' || result.role === 'admin') {
            navigate('/admin');
        } else {
            navigate('/dashboard');
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setError('');
        setIsSubmitting(true);

        const result = await login(empNo, password);

        if (result.success) {
            if (result.user?.is_face_enabled) {
                setFaceVerifyData(result.user.face_descriptor);
                setLoginResult(result);
                // Keep the token and userData safe until verification
                setPendingLoginTokens({ token: result.token, userData: result.userData });
                setIsSubmitting(false);
                return;
            }
            handleLoginSuccess(result, { token: result.token, userData: result.userData });
        } else {
            setError(result.message);
        }
        setIsSubmitting(false);
    };


    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-teal-100/40 via-transparent to-transparent"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-teal-100/40 via-transparent to-transparent"></div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-teal-900/5 overflow-hidden relative z-10 border border-slate-100"
            >
                <div className="p-8 sm:p-12">
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center w-28 h-28 bg-white rounded-3xl mb-6 shadow-xl border border-gray-100 overflow-hidden">
                            <img src="/logo.jpg" alt="ETHREE Logo" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">ETHREE TRACKER</h1>
                        <p className="text-slate-500 mt-2 font-medium">{faceVerifyData ? 'Biometric Verification' : 'Sign in to your account'}</p>
                    </div>

                    {faceVerifyData ? (
                        <div className="space-y-6">
                            <FaceCapture
                                label="Verification Required"
                                targetDescriptor={faceVerifyData}
                                onVerify={(matched) => matched && handleLoginSuccess(loginResult, pendingLoginTokens)}
                                onMismatch={async (descriptor, image) => {
                                    try {
                                        await api.post('/auth/proxy-attempt', {
                                            emp_no: empNo,
                                            face_descriptor: descriptor,
                                            image_data: image,
                                            device_info: navigator.userAgent
                                        });
                                        console.log('[SECURITY] Proxy attempt reported to server');
                                    } catch (err) {
                                        console.error('Failed to report proxy attempt:', err);
                                    }
                                }}
                            />
                            <button
                                onClick={() => { setFaceVerifyData(null); setLoginResult(null); }}
                                className="w-full py-2 text-slate-400 font-bold hover:text-slate-600 transition-all text-xs uppercase tracking-widest"
                            >
                                Cancel & Back to Login
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl"
                                >
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <div className="flex flex-col">
                                        <p className="text-xs font-bold">{error}</p>

                                        {/* WiFi SSID Mismatch */}
                                        {window.lastErrorData?.debug_info?.error === 'SSID_MISMATCH' && (
                                            <div className="mt-2 p-2 bg-slate-900/5 rounded-lg text-[10px] font-mono text-slate-500">
                                                <p>📡 Target WiFi: "{window.lastErrorData.debug_info.expected}"</p>
                                                <p>📱 Detected: "{window.lastErrorData.debug_info.received}"</p>
                                            </div>
                                        )}

                                        {/* IP Mismatch (Mobile Browser Case) */}
                                        {window.lastErrorData?.debug_info?.error === 'IP_MISMATCH' && (
                                            <div className="mt-2 p-2 bg-slate-900/5 rounded-lg text-[10px] font-mono text-slate-500">
                                                <p>🌐 Office IP: "{window.lastErrorData.debug_info.expected}"</p>
                                                <p>🌍 Your IP: "{window.lastErrorData.debug_info.received}"</p>
                                                <p className="mt-1 text-red-500 font-sans italic tracking-tight">Browsers can't see WiFi names. Your IP must match the Office IP.</p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Employee ID</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-teal-500 transition-colors">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        value={empNo}
                                        onChange={(e) => setEmpNo(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none text-slate-800 font-medium"
                                        placeholder="EMP001"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-teal-500 transition-colors">
                                        <Lock className="w-5 h-5" />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none text-slate-800 font-medium"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-teal-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-lg shadow-lg shadow-teal-600/20 hover:shadow-teal-600/40 transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-widest"
                            >
                                {isSubmitting ? 'Verifying...' : 'Sign In'}
                            </button>
                        </form>
                    )}
                </div>

                <div className="p-6 bg-slate-50/50 border-t border-slate-100 text-center">
                    <p className="text-xs text-slate-500 font-bold">
                        ETHREE TRACKER © {new Date().getFullYear()}
                    </p>
                </div>
            </motion.div>

        </div>
    );
};

export default LoginPage;
