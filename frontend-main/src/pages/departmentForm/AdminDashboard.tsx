import React, { useState, useEffect } from 'react';
import { Plus, Link2, Copy, Download, CheckCircle2, Clock, RotateCcw, Filter, Mail, X, Loader2, Trash2, AlertTriangle, LogOut, ChevronRight } from 'lucide-react';
import { ApiConsumer } from '@/lib/api';
import { useToast } from '@/contexts/ToastProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/auth_service';
import { useAuth } from '@/contexts/AuthProvider';
import { DepartmentFormPdf } from './components/DepartmentFormPdf';
import { generateDepartmentFormPdf } from './utils/pdfGenerator';
import { logger } from "@/utils/logger";



const AdminDashboard: React.FC = () => {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { clear } = useAuth();
    const [links, setLinks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [email, setEmail] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; serial: string } | null>(null);
    const [printingData, setPrintingData] = useState<any>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [workflowEmails, setWorkflowEmails] = useState<string[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [formFields, setFormFields] = useState({
        invoice_no: '',
        department_name: '',
        po_number: '',
        commodity_type: '',
        contract_value_currency: 'KES',
        contract_value_amount: '',
        designated_program: ''
    });

    const fetchForms = async () => {
        setIsLoading(true);
        try {
            const res = await ApiConsumer.get('/department/forms/');
            setLinks((res as never[]) || []);
        } catch {
            showToast('Failed to fetch forms', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchConfig = async () => {
        try {
            const res: any = await ApiConsumer.get('/department/workflow-config/');
            setWorkflowEmails(res.dropdown_emails || []);
        } catch (err) {
            logger.error('Failed to fetch workflow config:', err);
        }
    };

    useEffect(() => {
        fetchForms();
        fetchConfig();
    }, []);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            clear();
            // Call the unified backend logout which clears backend tokens and local storage
            await authService.logout();
        } catch (err) {
            logger.error('Logout error:', err);
        } finally {
            setIsLoggingOut(false);
            navigate('/login', { replace: true });
        }
    };

    const handleGenerateLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsGenerating(true);
        try {
            const res = await ApiConsumer.post('/department/generate-link/', {
                email,
                ...formFields
            });
            const token = res.access_link?.token;
            const fullLink = `${window.location.origin}/departmentForm/fill?token=${token}`;

            navigator.clipboard.writeText(fullLink);
            showToast('Link generated and copied to clipboard!', 'success');

            setEmail('');
            setFormFields({
                invoice_no: '',
                department_name: '',
                po_number: '',
                commodity_type: '',
                contract_value_currency: 'KES',
                contract_value_amount: '',
                designated_program: ''
            });
            setShowModal(false);
            fetchForms();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to generate link';
            showToast(message, 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopyLink = (token: string) => {
        const fullLink = `${window.location.origin}/departmentForm/fill?token=${token}`;
        navigator.clipboard.writeText(fullLink);
        showToast('Link copied to clipboard!', 'success');
    };

    const handleReactivate = async (id: number) => {
        try {
            await ApiConsumer.post(`/department/reactivate-link/${id}/`, {});
            showToast('Link reactivated for 48 hours', 'success');
            fetchForms();
        } catch {
            showToast('Failed to reactivate link', 'error');
        }
    };

    const handleDelete = (id: number, serialNo: string) => {
        setDeleteConfirm({ id, serial: serialNo });
    };

    const performDelete = async () => {
        if (!deleteConfirm) return;
        setIsDeleting(true);
        try {
            await ApiConsumer.delete(`/department/delete-form/${deleteConfirm.id}/`);
            showToast('Form deleted successfully', 'success');
            setDeleteConfirm(null);
            fetchForms();
        } catch (err: any) {
            const message = err?.message || 'Failed to delete form';
            showToast(message, 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDownloadPdf = async (link: Record<string, any>) => {
        setIsGeneratingPdf(true); // Show loader immediately
        let latestLinkData = link;
        try {
            // Guarantee fresh data: refetch the list to get the latest record
            const res = await ApiConsumer.get('/department/forms/');
            const forms = (res as any[]) || [];
            const freshForm = forms.find(f => f.id === link.id);
            if (freshForm) latestLinkData = freshForm;
        } catch (err) {
            logger.warn("Could not fetch fresh form data, using cached.");
        }

        await generateDepartmentFormPdf(
            'department-form-pdf',
            latestLinkData,
            () => {
                setPrintingData(latestLinkData);
            },
            () => {
                setIsGeneratingPdf(false);
                setPrintingData(null);
                showToast('PDF Record saved successfully!', 'success');
            },
            (error) => {
                setIsGeneratingPdf(false);
                setPrintingData(null);
                showToast('Failed to generate PDF. Please try again.', 'error');
            }
        );
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'COMPLETED': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
            case 'DRAFT': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
            default: return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
        }
    };

    const stats = {
        active: links.filter(l => l.access_link?.is_active).length,
        completed: links.filter(l => l.status === 'COMPLETED').length,
        draft: links.filter(l => l.status === 'SECTION_A_PENDING' || l.status === 'SECTION_B_PENDING' || l.status === 'SECTION_C_PENDING' || l.status === 'SECTION_D_PENDING').length
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.6,
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="min-h-screen bg-slate-50/50 space-y-8"
        >
            <header className="bg-[#0F172A] border-b border-white/5 relative overflow-hidden px-8 py-8 mb-4">
                {/* Decorative mesh background for header */}
                <div className="absolute top-0 right-0 h-64 w-64 bg-indigo-600/10 rounded-full blur-[80px] -mr-32 -mt-32" />
                <div className="absolute top-0 left-0 h-40 w-40 bg-blue-600/10 rounded-full blur-[60px] -ml-20 -mt-20" />

                <div className="max-w-7xl mx-auto flex items-center justify-between relative z-10">
                    <motion.div variants={itemVariants}>
                        <h1 className="text-2xl font-black text-white tracking-tight">
                            Supplier <br /> <span className="text-indigo-400">Performance Payment Authorization </span>Report
                        </h1>
                        <div className="flex flex-col mt-1">
                            <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Strictly Confidential </span>
                            <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Not For Release Outside WHO</span>
                        </div>
                    </motion.div>

                    <div className="flex items-center gap-3">
                        <motion.button
                            variants={itemVariants}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowModal(true)}
                            className="flex items-center space-x-2 bg-indigo-600 text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-[0_12px_24px_-8px_rgba(79,70,229,0.5)] hover:bg-indigo-500 transition-all duration-300"
                        >
                            <Plus size={18} />
                            <span>Generate New Link</span>
                        </motion.button>
                        <motion.button
                            variants={itemVariants}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            className="flex items-center space-x-2 bg-white/10 text-white/70 hover:text-white hover:bg-white/20 px-4 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 border border-white/10"
                            title="Logout & Clear Cache"
                        >
                            {isLoggingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
                            <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                        </motion.button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-8 space-y-8 pb-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { label: 'Active Links', value: stats.active, icon: Link2, color: '#3B82F6' },
                        { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: '#10B981' },
                        { label: 'Draft / Pending', value: stats.draft, icon: Clock, color: '#F59E0B' }
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            variants={itemVariants}
                            whileHover={{ y: -5 }}
                            className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.03)] flex items-center justify-between hover:shadow-[0_20px_60px_rgba(0,0,0,0.06)] transition-all duration-500"
                        >
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                                <p className="text-3xl font-black text-slate-900">{String(stat.value).padStart(2, '0')}</p>
                            </div>
                            <div
                                className="h-11 w-11 rounded-full flex items-center justify-center text-white shadow-lg"
                                style={{
                                    backgroundColor: stat.color,
                                    boxShadow: `0 8px 24px -6px ${stat.color}60`
                                }}
                            >
                                <stat.icon size={20} />
                            </div>
                        </motion.div>
                    ))}
                </div>

                <motion.div
                    variants={itemVariants}
                    className="bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.03)] overflow-hidden"
                >
                    <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-6 w-1.5 rounded-full bg-indigo-600" />
                            <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Recent Generated Links</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <motion.button
                                whileHover={{ rotate: 180 }}
                                transition={{ duration: 0.5 }}
                                onClick={fetchForms}
                                className="h-10 w-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            >
                                <RotateCcw size={18} />
                            </motion.button>
                            <button className="h-10 w-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                                <Filter size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[60vh] overflow-y-auto custom-scrollbar">
                        <AnimatePresence mode="wait">
                            {isLoading ? (
                                <motion.div
                                    key="loader"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex flex-col items-center justify-center py-24 space-y-4"
                                >
                                    <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Synchronizing Records...</p>
                                </motion.div>
                            ) : links.length === 0 ? (
                                <motion.div
                                    key="empty"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-center py-24 px-6"
                                >
                                    <div className="h-24 w-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <Link2 size={32} className="text-slate-300" />
                                    </div>
                                    <h4 className="text-xl font-black text-slate-900">No links generated yet</h4>
                                    <p className="text-slate-500 max-w-xs mx-auto mt-3 text-sm font-medium">Start by generating a secure departmental access link for a department.</p>
                                </motion.div>
                            ) : (
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50/50">
                                            <th className="px-10 py-5">Serial No</th>
                                            <th className="px-10 py-5">Status</th>
                                            <th className="px-10 py-5">Target Supplier</th>
                                            <th className="px-10 py-5">Date Generated</th>
                                            <th className="px-10 py-5 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        <AnimatePresence>
                                            {links.map((link, idx) => (
                                                <motion.tr
                                                    key={link.id}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 10 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    className="hover:bg-slate-50/50 transition-colors group"
                                                >
                                                    <td className="px-10 py-6 font-black text-slate-900 text-sm tracking-tight">{link.serial_no}</td>
                                                    <td className="px-10 py-6">
                                                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black border uppercase tracking-widest ${getStatusColor(link.status)}`}>
                                                            {link.status_display || link.status.replace(/_/g, ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="px-10 py-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black text-slate-700 tracking-tight">
                                                                {link.department_name || 'Generic Link'}
                                                            </span>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <Mail size={10} className="text-slate-300" />
                                                                <span className="text-[10px] text-slate-400 font-bold truncate max-w-[150px]">
                                                                    {link.access_link?.target_email || 'No Recipient'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-10 py-6 text-sm font-bold text-slate-400">
                                                        {new Date(link.created_at).toLocaleDateString('en-GB')}
                                                    </td>
                                                    <td className="px-10 py-6">
                                                        <div className="flex items-center justify-end space-x-2">
                                                            <motion.button
                                                                whileHover={{ scale: 1.1, backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                                                                whileTap={{ scale: 0.9 }}
                                                                onClick={() => handleCopyLink(link.access_link?.token)}
                                                                className={`h-10 w-10 flex items-center justify-center rounded-xl transition-all
                                                                    ${link.access_link?.token ? 'text-slate-400 hover:text-blue-600' : 'text-slate-200 cursor-not-allowed'}
                                                                 `}
                                                                disabled={!link.access_link?.token}
                                                                title={link.access_link?.token ? `Copy Latest Link: ${link.access_link?.target_email}` : "No link available"}
                                                            >
                                                                <Copy size={18} />
                                                            </motion.button>
                                                            <motion.button
                                                                whileHover={{ scale: 1.1, backgroundColor: 'rgba(245, 158, 11, 0.1)' }}
                                                                whileTap={{ scale: 0.9 }}
                                                                onClick={() => handleReactivate(link.id)}
                                                                className="h-10 w-10 flex items-center justify-center text-slate-400 hover:text-amber-600 rounded-xl transition-all"
                                                                title="Reactivate Link"
                                                            >
                                                                <RotateCcw size={18} />
                                                            </motion.button>

                                                            <motion.button
                                                                whileHover={{ scale: 1.1, backgroundColor: 'rgba(15, 23, 42, 0.05)' }}
                                                                whileTap={{ scale: 0.9 }}
                                                                onClick={() => handleDownloadPdf(link)}
                                                                className="h-10 w-10 flex items-center justify-center text-slate-400 hover:text-slate-900 rounded-xl transition-all"
                                                                title="Download PDF"
                                                            >
                                                                <Download size={18} />
                                                            </motion.button>
                                                            <motion.button
                                                                whileHover={{ scale: 1.1, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                                                                whileTap={{ scale: 0.9 }}
                                                                onClick={() => handleDelete(link.id, link.serial_no)}
                                                                className="h-10 w-10 flex items-center justify-center text-slate-400 hover:text-red-500 rounded-xl transition-all"
                                                                title="Delete Form"
                                                            >
                                                                <Trash2 size={18} />
                                                            </motion.button>
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </AnimatePresence>
                                    </tbody>
                                </table>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>

            {/* Link Generation Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/80 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl ring-1 ring-gray-100"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Generate Secure Link</h2>
                                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X className="h-5 w-5 text-gray-400" /></button>
                            </div>

                            <form onSubmit={handleGenerateLink} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Department Email Address <span className="text-red-500">*</span></label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors z-30 pointer-events-none" />

                                        <button
                                            type="button"
                                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                            className="w-full bg-gray-50 border-0 rounded-2xl py-4 pl-12 pr-10 text-left text-gray-900 ring-1 ring-gray-100 focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none transition-all duration-300 flex items-center justify-between"
                                        >
                                            <span className={email ? 'text-gray-900 font-bold' : 'text-gray-400 font-medium'}>
                                                {email || "Select Recipient Email"}
                                            </span>
                                            <ChevronRight className={`h-5 w-5 text-gray-400 transition-transform duration-300 ${isDropdownOpen ? '-rotate-90' : 'rotate-90'}`} />
                                        </button>

                                        <AnimatePresence>
                                            {isDropdownOpen && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                                    className="absolute top-full mt-2 left-0 right-0 bg-white border border-gray-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden z-[100] p-1"
                                                >
                                                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                                        {workflowEmails.map((em) => (
                                                            <button
                                                                key={em}
                                                                type="button"
                                                                onClick={() => {
                                                                    setEmail(em);
                                                                    setIsDropdownOpen(false);
                                                                }}
                                                                className={`w-full px-4 py-3 text-left text-[13px] font-bold rounded-xl transition-all
                                                                    ${email === em
                                                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                                                        : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600'}
                                                                `}
                                                            >
                                                                {em}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 flex items-start space-x-3">
                                    <Clock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs font-bold text-blue-800 leading-relaxed">
                                        This link will automatically expire in <span className="underline decoration-2">48 hours</span>. Access can be extended from the dashboard.
                                    </p>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit"
                                    disabled={isGenerating}
                                    className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black hover:bg-gray-800 transition-all duration-300 shadow-xl shadow-gray-200 disabled:opacity-50 flex items-center justify-center space-x-2"
                                >
                                    {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <span>Confirm & Copy Link</span>}
                                </motion.button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            {/* Hidden PDF Engine for capture - Standardized Isolation */}
            <div className="fixed opacity-0 pointer-events-none -z-50 left-[-9999px] top-0 w-[850px]" style={{ colorScheme: 'light' }}>
                {printingData && (
                    <DepartmentFormPdf data={printingData} particulars={printingData} />
                )}
            </div>

            {/* Global PDF Generation Overlay */}
            <AnimatePresence>
                {isGeneratingPdf && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center text-center p-6"
                    >
                        <div className="bg-white/10 backdrop-blur-xl p-12 rounded-[3rem] border border-white/20 shadow-2xl max-w-sm w-full">
                            <div className="relative mb-8">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="w-24 h-24 rounded-full border-t-2 border-r-2 border-indigo-500 border-b-2 border-l-2 border-transparent"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Download className="text-white h-8 w-8 animate-bounce" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Engaging PDF Engine</h3>
                            <p className="text-indigo-200 text-sm font-medium leading-relaxed">
                                Authoring high-fidelity performance report for <span className="text-white font-black">{printingData?.serial_no}</span>...
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {deleteConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0F172A]/80 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl overflow-hidden relative"
                        >
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-500" />

                            <div className="flex flex-col items-center text-center">
                                <div className="h-16 w-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mb-6">
                                    <AlertTriangle size={32} />
                                </div>

                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Delete Report?</h3>
                                <p className="text-sm font-medium text-slate-500 leading-relaxed mb-8">
                                    Are you sure you want to delete <span className="text-slate-900 font-black">{deleteConfirm.serial}</span>? This action is permanent and cannot be reversed.
                                </p>

                                <div className="grid grid-cols-2 gap-4 w-full">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setDeleteConfirm(null)}
                                        className="py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 hover:text-slate-600 transition-all"
                                    >
                                        Cancel
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={performDelete}
                                        disabled={isDeleting}
                                        className="py-4 bg-red-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-200 hover:bg-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isDeleting ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : null}
                                        <span>{isDeleting ? 'Deleting...' : 'Delete Now'}</span>
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default AdminDashboard;
