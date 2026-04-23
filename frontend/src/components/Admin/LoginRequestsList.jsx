import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { motion } from 'framer-motion';
import { Check, X, Clock, User, MessageCircle, Smartphone } from 'lucide-react';

const LoginRequestsList = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            const response = await api.get('/admin/login-requests');
            setRequests(response.data);
        } catch (error) {
            console.error('Failed to fetch login requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (id, action) => {
        try {
            await api.post(`/admin/handle-login-request/${id}`, { action });
            fetchRequests(); // Refresh
        } catch (error) {
            console.error(`Failed to ${action} request:`, error);
            alert(`Failed to ${action} request`);
        }
    };

    if (loading) return <div className="text-center py-10">Loading requests...</div>;

    const pendingRequests = requests.filter(r => r.status === 'Pending');

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-6">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-teal-500" />
                Pending Login Requests
                {pendingRequests.length > 0 && (
                    <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-1">
                        {pendingRequests.length}
                    </span>
                )}
            </h3>

            {pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No pending login requests</div>
            ) : (
                <div className="space-y-4">
                    {pendingRequests.map((req) => (
                        <motion.div
                            key={req.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50 rounded-xl gap-4 border border-gray-100"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center text-teal-700 shrink-0">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800">{req.emp_name} <span className="text-xs font-normal text-gray-400 ms-1">#{req.emp_no}</span></h4>
                                    <div className="flex items-center gap-4 mt-1">
                                        <div className="flex items-center gap-1 text-xs text-gray-500">
                                            <Clock className="w-3.5 h-3.5" />
                                            {new Date(req.request_time).toLocaleTimeString()}
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-gray-500">
                                            <Smartphone className="w-3.5 h-3.5" />
                                            {req.device_info}
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-1.5 mt-2 bg-white/50 p-2 rounded-lg border border-gray-100">
                                        <MessageCircle className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                                        <p className="text-xs text-gray-600 line-clamp-2">{req.reason}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleAction(req.id, 'Approved')}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-bold transition-all shadow-sm hover:shadow-green-200"
                                >
                                    <Check className="w-4 h-4" />
                                    Approve
                                </button>
                                <button
                                    onClick={() => handleAction(req.id, 'Rejected')}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-bold transition-all border border-red-100"
                                >
                                    <X className="w-4 h-4" />
                                    Reject
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LoginRequestsList;
