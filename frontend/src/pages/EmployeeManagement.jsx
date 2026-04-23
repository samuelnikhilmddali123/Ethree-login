import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Mail, Shield, Search, Plus, X, Calendar, Trash2, CheckCircle2, Clock, AlertCircle, XCircle, Edit, Wifi, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AttendanceCalendar from '../components/AttendanceCalendar';
import FaceCapture from '../components/FaceCapture';

const EmployeeManagement = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [filterDate, setFilterDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));

    const [createForm, setCreateForm] = useState({
        emp_no: '', name: '', full_name: '', email: '', password: '', role: 'employee',
        face_descriptor: [], is_face_enabled: false
    });

    const [showEditModal, setShowEditModal] = useState(null);
    const [editForm, setEditForm] = useState({
        name: '', full_name: '', email: '', password: '', role: 'employee',
        is_face_enabled: false, is_wifi_login_enabled: true
    });

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showAttendanceModal, setShowAttendanceModal] = useState(null);
    const [employeeAttendance, setEmployeeAttendance] = useState([]);
    const [loadingAttendance, setLoadingAttendance] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(null);

    useEffect(() => {
        fetchEmployees();
        const interval = setInterval(() => {
            fetchEmployees();
        }, 30000); // auto-refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const fetchEmployees = async () => {
        try {
            const response = await api.get('/admin/employees');
            setEmployees(response.data);
        } catch (error) {
            console.error('Failed to fetch employees:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateEmployee = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            await api.post('/admin/employees', createForm);
            setSuccess('Employee created successfully!');
            setShowCreateModal(false);
            setCreateForm({ emp_no: '', name: '', full_name: '', email: '', password: '', role: 'employee', face_descriptor: [], is_face_enabled: false });
            fetchEmployees();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create employee');
        }
    };

    const openEditModal = (emp) => {
        setEditForm({
            name: emp.name,
            full_name: emp.full_name || '',
            email: emp.email,
            password: '', 
            role: emp.role,
            is_face_enabled: emp.is_face_enabled || false,
            is_wifi_login_enabled: emp.is_wifi_login_enabled !== false,
            has_face_descriptor: emp.has_face_descriptor || false
        });
        setShowEditModal(emp.emp_no);
        setError('');
        setSuccess('');
    };

    const handleEditEmployee = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            const payload = { ...editForm };
            if (!payload.password) delete payload.password; 

            await api.put(`/admin/employees/${showEditModal}`, payload);
            setSuccess('Employee updated successfully!');
            setShowEditModal(null);
            fetchEmployees();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update employee');
        }
    };

    const fetchEmployeeAttendance = async (emp_no) => {
        setLoadingAttendance(true);
        try {
            const attRes = await api.get(`/attendance/admin/history/${emp_no}`);
            setEmployeeAttendance(attRes.data.attendance);
            setShowAttendanceModal(emp_no);
        } catch (err) {
            setError('Failed to fetch attendance records');
        } finally {
            setLoadingAttendance(false);
        }
    };

    const handleDeleteEmployee = async (emp_no) => {
        setError('');
        setSuccess('');
        try {
            await api.delete(`/admin/employees/${emp_no}`);
            setSuccess('Employee deleted successfully!');
            setShowDeleteModal(null);
            fetchEmployees();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete employee');
            setShowDeleteModal(null);
        }
    };

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.full_name && emp.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        emp.emp_no.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="p-10 text-center text-gray-500">Loading Directory...</div>;

    return (
        <div className="space-y-6">
            {/* Success/Error Messages */}
            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl">{success}</div>
            )}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">{error}</div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all text-sm"
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex-1 sm:flex-none px-4 py-2 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="whitespace-nowrap">Create Employee</span>
                    </button>
                </div>
            </div>

            {/* Employee Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEmployees.map((emp) => (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        key={emp.id}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden group"
                    >
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                {emp.profile_picture ? (
                                    <img
                                        src={emp.profile_picture}
                                        alt={emp.name}
                                        className="w-14 h-14 rounded-2xl border-2 border-teal-100 object-cover"
                                    />
                                ) : (
                                    <div className="w-14 h-14 bg-teal-50 border-2 border-teal-100 rounded-2xl flex items-center justify-center text-teal-600 text-xl font-bold">
                                        {emp.name.charAt(0)}
                                    </div>
                                )}
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${emp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {emp.status}
                                </span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 group-hover:text-teal-600 transition-colors uppercase truncate">{emp.full_name || emp.name}</h3>
                            <p className="text-sm text-gray-500 font-medium mt-0.5">@{emp.name} · ID: {emp.emp_no}</p>
                            <div className="mt-6 space-y-3">
                                <div className="flex items-center gap-3 text-sm text-gray-600">
                                    <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                                    <span className="truncate">{emp.email}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-600">
                                    <Shield className="w-4 h-4 text-gray-400 shrink-0" />
                                    <span className="capitalize">{emp.role}</span>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap justify-between gap-2">
                            <button
                                onClick={() => setShowDeleteModal(emp.emp_no)}
                                className="text-xs font-bold text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all flex items-center gap-1"
                            >
                                <Trash2 className="w-3 h-3" />
                                Delete
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => openEditModal(emp)}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all flex items-center gap-1"
                                >
                                    <Edit className="w-3 h-3" />
                                    Edit
                                </button>
                                <button
                                    onClick={() => fetchEmployeeAttendance(emp.emp_no)}
                                    className="text-xs font-bold text-teal-600 hover:text-teal-700 px-3 py-1.5 rounded-lg hover:bg-teal-50 transition-all flex items-center gap-1"
                                >
                                    <Calendar className="w-3 h-3" />
                                    Attendance
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Attendance View Modal */}
            <AnimatePresence>
                {showAttendanceModal && (
                    <Modal
                        title={`Attendance History - ${showAttendanceModal}`}
                        onClose={() => { setShowAttendanceModal(null); setEmployeeAttendance([]); }}
                        wide
                    >
                        <div className="max-h-[80vh] overflow-y-auto pr-2">
                            <AttendanceCalendar
                                attendanceHistory={employeeAttendance}
                            />
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Create Employee Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <Modal
                        title="Create New Employee"
                        onClose={() => { setShowCreateModal(false); setCreateForm({ emp_no: '', name: '', full_name: '', email: '', password: '', role: 'employee', face_descriptor: [], is_face_enabled: false }); setError(''); }}
                    >
                        {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">{error}</div>}
                        <form onSubmit={handleCreateEmployee} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Employee ID</label>
                                <input type="text" required value={createForm.emp_no} onChange={(e) => setCreateForm({ ...createForm, emp_no: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" placeholder="e.g., EMP001" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Username (Login Name)</label>
                                <input type="text" required value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" placeholder="e.g. sonali" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                                <input type="text" required value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" placeholder="e.g. Sonali Kumari" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                                <input type="email" required value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" placeholder="email@company.com" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
                                <input type="password" required value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" placeholder="Minimum 6 characters" minLength={6} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                                <select value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none">
                                    <option value="employee">Employee</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            <div className="pt-2">
                                <label className="block text-sm font-semibold text-gray-700 mb-3">Face Detection Enrollment (Optional)</label>
                                {createForm.face_descriptor?.length > 0 ? (
                                    <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
                                                <CheckCircle2 className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-green-800">Face Enrolled</p>
                                                <p className="text-[10px] text-green-600 font-medium">Biometric data ready</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setCreateForm({ ...createForm, face_descriptor: [], is_face_enabled: false })}
                                            className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                ) : (
                                    <FaceCapture
                                        label="Enroll Face for Secure Login"
                                        onCapture={(descriptor) => setCreateForm({ ...createForm, face_descriptor: descriptor, is_face_enabled: true })}
                                    />
                                )}
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => { setShowCreateModal(false); setError(''); }} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-all">Cancel</button>
                                <button type="submit" className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-all">Create Employee</button>
                            </div>
                        </form>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Edit Employee Modal */}
            <AnimatePresence>
                {showEditModal && (
                    <Modal
                        title="Edit Employee"
                        onClose={() => { setShowEditModal(null); setError(''); }}
                    >
                        {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">{error}</div>}
                        <form onSubmit={handleEditEmployee} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Username (Login Name)</label>
                                <input type="text" required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                                <input type="text" required value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                                <input type="email" required value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">New Password (Optional)</label>
                                <input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" placeholder="Leave blank to keep current" minLength={6} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none">
                                    <option value="employee">Employee</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            <div className="pt-4 space-y-3">
                                <label className="block text-sm font-bold text-gray-800 mb-2 border-b pb-2">Security & Login Restrictions</label>
                                
                                <div className="bg-white rounded-2xl p-4 flex items-center justify-between border border-gray-100 shadow-sm mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-[#EFEFFF] rounded-xl flex items-center justify-center text-[#6200EE]">
                                            <Wifi className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 text-base">WiFi Login Restricted</h4>
                                            <p className="text-sm text-gray-500 font-medium">Require Office WiFi for login</p>
                                        </div>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => setEditForm({...editForm, is_wifi_login_enabled: !editForm.is_wifi_login_enabled})}
                                        className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-300 ${editForm.is_wifi_login_enabled ? 'bg-[#6200EE]' : 'bg-gray-200'}`}
                                    >
                                        <div className={`bg-white w-6 h-6 rounded-full shadow-sm transform transition-transform duration-300 ${editForm.is_wifi_login_enabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                    </button>
                                </div>

                                {editForm.has_face_descriptor ? (
                                    <>
                                        <div className="bg-red-50 rounded-2xl p-4 flex items-center justify-between border border-red-100 shadow-sm mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
                                                    <Trash2 className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-red-800 text-sm">Face Data Enrolled</h4>
                                                    <p className="text-xs text-red-600 font-medium">Remove to allow re-enrollment</p>
                                                </div>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => setEditForm({...editForm, face_descriptor: [], has_face_descriptor: false, is_face_enabled: false})}
                                                className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg transition-all shadow-sm"
                                            >
                                                Delete Data
                                            </button>
                                        </div>
                                        <div className="bg-white rounded-2xl p-4 flex items-center justify-between border border-gray-100 shadow-sm">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-[#EFEFFF] rounded-xl flex items-center justify-center text-[#6200EE]">
                                                    <Camera className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900 text-base">Face Login Restricted</h4>
                                                    <p className="text-sm text-gray-500 font-medium">Require Face ID for login</p>
                                                </div>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => setEditForm({...editForm, is_face_enabled: !editForm.is_face_enabled})}
                                                className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-300 ${editForm.is_face_enabled ? 'bg-[#6200EE]' : 'bg-gray-200'}`}
                                            >
                                                <div className={`bg-white w-6 h-6 rounded-full shadow-sm transform transition-transform duration-300 ${editForm.is_face_enabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="pt-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-3">Face Detection Enrollment</label>
                                        <FaceCapture
                                            label="Enroll Face for Secure Login"
                                            onCapture={(descriptor) => setEditForm({ ...editForm, face_descriptor: descriptor, has_face_descriptor: true, is_face_enabled: true })}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-6">
                                <button type="button" onClick={() => { setShowEditModal(null); setError(''); }} className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-700 font-bold hover:bg-gray-50 transition-all">Cancel</button>
                                <button type="submit" className="flex-1 px-4 py-3 bg-[#6200EE] text-white rounded-xl font-bold hover:bg-[#5000D0] transition-all">Save Changes</button>
                            </div>
                        </form>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {showDeleteModal && (
                    <Modal title="Delete Employee" onClose={() => setShowDeleteModal(null)}>
                        <div className="space-y-4">
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                <p className="text-red-800 font-medium">Are you sure you want to delete employee <strong>{showDeleteModal}</strong>?</p>
                                <p className="text-red-600 text-sm mt-2">This action cannot be undone. All attendance records will be permanently deleted.</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowDeleteModal(null)} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-all">Cancel</button>
                                <button onClick={() => handleDeleteEmployee(showDeleteModal)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-all">Delete Employee</button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
};

const Modal = ({ title, children, onClose, wide }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
    >
        <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={`bg-white rounded-2xl shadow-2xl ${wide ? 'max-w-5xl' : 'max-w-md'} w-full p-6 max-h-[90vh] overflow-y-auto`}
        >
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <X className="w-6 h-6" />
                </button>
            </div>
            {children}
        </motion.div>
    </motion.div>
);

export default EmployeeManagement;
