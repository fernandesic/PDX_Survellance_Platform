import React, { useRef } from 'react';
import { CheckCircle2, CircleDot, Lock, Pencil, X, Upload, ChevronDown } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { motion, AnimatePresence } from 'framer-motion';

interface SectionCardProps {
    meta: any;
    questions: any[];
    isActive: boolean;
    isDone: boolean;
    isLocked: boolean;
    data: any;
    signature: string;
    showName?: boolean;
    showDate?: boolean;
    showSignature?: boolean;
    signatureHeading?: string;
    uploadedSig?: string | null;
    onUploadSig?: (base64: string) => void;
    onChange: (key: string, val: string) => void;
    onClearSig: () => void;
    sigRef: React.RefObject<any>;
    errors?: string[];
}

export const SectionCard: React.FC<SectionCardProps> = ({
    meta, questions, isActive, isDone, isLocked, data, signature,
    showName = true, showDate = true, showSignature = true,
    signatureHeading, uploadedSig, onUploadSig, onChange, onClearSig, sigRef,
    errors = []
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onUploadSig) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onUploadSig(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <motion.div
            initial={false}
            animate={{
                scale: isActive ? 1.01 : 1,
                opacity: isLocked ? 0.6 : 1,
            }}
            className={`relative overflow-hidden rounded-[32px] mt-2 border transition-all duration-500 shadow-sm
                ${isActive ? 'bg-white border-white/20 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.06)] ring-1 ring-slate-100' : 'bg-[#F8FAFC]/50 border-slate-100'}
            `}
            style={{
                borderTop: isActive ? `4px solid ${meta.color}` : `1px solid transparent`,
            }}
        >
            {isLocked && (
                <div className="absolute inset-0 z-50 bg-white/40 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center">
                    <div className="h-6 w-6 rounded-xl bg-white shadow-xl flex items-center justify-center mb-4">
                        <Lock className="h-5 w-5 text-slate-300" />
                    </div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Locked Section</p>
                    <p className="text-[11px] font-medium text-slate-400 mt-1">Complete the previous stage to authorize access</p>
                </div>
            )}

            {/* Header Area */}
            <div className="p-8 pb-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div
                            className={`h-8 w-8 rounded-xl flex items-center justify-center font-black text-base shadow-lg transition-all duration-500
                                ${isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-[#0F172A] text-white shadow-[#0F172A]/20' : 'bg-white text-slate-300 border border-slate-100'}
                            `}
                            style={{ background: isDone ? undefined : isActive ? undefined : 'white' }}
                        >
                            {isDone ? <CheckCircle2 className="h-5 w-5" /> : meta.letter}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-[#0F172A] tracking-tight flex items-center gap-2">
                                {meta.title}
                                {isDone && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                            </h3>
                            <p className="text-sm font-medium text-slate-500 mt-0.5">{meta.subtitle}</p>
                        </div>
                    </div>

                    <div className="hidden sm:block">
                        <AnimatePresence mode="wait">
                            {isActive && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50/50 border border-blue-100 text-[10px] font-black uppercase tracking-widest text-blue-600"
                                >
                                    <CircleDot className="h-3 w-3 animate-pulse" />
                                    Live Session
                                </motion.div>
                            )}
                            {isDone && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50/50 border border-emerald-100 text-[10px] font-black uppercase tracking-widest text-emerald-600"
                                >
                                    <CheckCircle2 className="h-3 w-3" />
                                    Verified
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-8">
                {meta.letter === 'A' && (
                    <div className="mb-6">
                        <h3 className="text-sm font-black text-indigo-700 uppercase tracking-widest border-b border-indigo-100 pb-2">
                            SECTION I : SUPPLY PERFORMANCE BASED PAYMENT.
                        </h3>
                    </div>
                )}
                <div className="space-y-6">
                    {questions.map((q: any, i: number) => {
                        const type = q.type || 'choice';
                        const isChoice = type === 'choice';
                        const isText = type === 'text';
                        const isTextArea = type === 'textarea';
                        const isStatic = type === 'static';

                        return (
                            <div key={q.key} className="pb-2 border-b border-slate-50 last:border-0 last:pb-0 space-y-4 group">
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[11px] font-black text-slate-400 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-500 transition-all duration-300">
                                        {String(i + 1).padStart(2, '0')}
                                    </div>
                                    <p className={`text-[15px] font-bold leading-relaxed tracking-tight pt-1
                                        ${errors.includes(q.key) ? 'text-red-500' : 'text-slate-700'}
                                    `}>
                                        {q.text} {!isStatic && <span className="text-red-500">*</span>}
                                    </p>
                                </div>

                                <div className="pl-12">
                                    {isChoice && (
                                        <div className="relative w-full max-w-xs">
                                            {/* Custom Dropdown */}
                                            <div className={`relative ${!isActive ? 'opacity-70' : ''}`}>
                                                <button
                                                    type="button"
                                                    disabled={!isActive}
                                                    onClick={() => {
                                                        const currentOpen = data?._dropdown_open === q.key;
                                                        onChange('_dropdown_open', currentOpen ? '' : q.key);
                                                    }}
                                                    className={`w-full h-12 px-5 pr-10 rounded-2xl bg-white border flex items-center justify-between transition-all outline-none text-sm font-bold text-slate-700
                                                        ${errors.includes(q.key) ? 'border-red-500 ring-4 ring-red-500/10' : 'border-slate-100 hover:border-indigo-200'}
                                                        ${!isActive ? 'cursor-not-allowed' : 'cursor-pointer'}
                                                    `}
                                                >
                                                    <span className={!data?.[q.key] ? 'text-slate-300 font-medium' : ''}>
                                                        {data?.[q.key] || 'Select an option'}
                                                    </span>
                                                    <ChevronDown
                                                        size={18}
                                                        className={`text-slate-400 transition-transform duration-300 ${data?._dropdown_open === q.key ? 'rotate-180 text-indigo-500' : ''}`}
                                                    />
                                                </button>

                                                <AnimatePresence>
                                                    {isActive && data?._dropdown_open === q.key && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                            transition={{ duration: 0.2, ease: "easeOut" }}
                                                            className="absolute z-[100] top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden"
                                                        >
                                                            <div className="py-2">
                                                                {(q.options || ['YES', 'NO', 'N/A']).map((opt: string) => {
                                                                    const isSelected = data?.[q.key] === opt;
                                                                    return (
                                                                        <button
                                                                            key={opt}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                onChange(q.key, opt);
                                                                                onChange('_dropdown_open', '');
                                                                            }}
                                                                            className={`w-full px-5 py-3 text-left text-sm font-bold transition-colors flex items-center justify-between
                                                                                ${isSelected ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-500'}
                                                                            `}
                                                                        >
                                                                            {opt}
                                                                            {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>
                                    )}

                                    {isText && (
                                        <input
                                            type="text"
                                            disabled={!isActive}
                                            value={data?.[q.key] || ''}
                                            onChange={(e) => onChange(q.key, e.target.value)}
                                            placeholder="Specify details..."
                                            className={`w-full h-10 px-4 rounded-2xl bg-white border focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm font-bold text-slate-700 placeholder:text-slate-300
                                                ${errors.includes(q.key) ? 'border-red-500 bg-red-50/50' : 'border-slate-100'}
                                            `}
                                        />
                                    )}

                                    {isTextArea && (
                                        <textarea
                                            disabled={!isActive}
                                            value={data?.[q.key] || ''}
                                            onChange={(e) => onChange(q.key, e.target.value)}
                                            rows={3}
                                            placeholder="Provide comprehensive feedback..."
                                            className={`w-full p-5 rounded-2xl bg-white border focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm font-bold text-slate-700 placeholder:text-slate-300 resize-none
                                                ${errors.includes(q.key) ? 'border-red-500 bg-red-50/50' : 'border-slate-100'}
                                            `}
                                        />
                                    )}

                                    {isStatic && (q.value || data?.[q.key]) && (
                                        <div className="w-full px-5 py-4 rounded-2xl bg-slate-100/50 border border-slate-100 text-sm font-black text-slate-600 tracking-tight">
                                            {q.value || data?.[q.key]}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Special Insert: SECTION II after Section A content */}
                {meta.letter === 'A' && (
                    <div className="mt-6 pt-4 border-t border-slate-100">
                        <div className="mb-4">
                            <h3 className="text-sm font-black text-indigo-700 uppercase tracking-widest border-b border-indigo-100 pb-2">
                                SECTION II: OTHER TYPES OF PAYMENTS
                            </h3>
                        </div>
                        <div className="space-y-6">
                            <div className="pb-2 space-y-4 group">
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[11px] font-black text-slate-400">01</div>
                                    <p className="text-[15px] font-bold leading-relaxed tracking-tight pt-1 text-slate-700">
                                        Description of product/service:
                                    </p>
                                </div>
                                <div className="pl-12">
                                    <textarea
                                        disabled={!isActive}
                                        value={data?.section2_q1 || ''}
                                        onChange={(e) => onChange('section2_q1', e.target.value)}
                                        rows={2}
                                        placeholder="Specify description..."
                                        className="w-full p-4 text-sm font-bold text-slate-700 rounded-2xl bg-white border border-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none placeholder:text-slate-300"
                                    />
                                </div>
                            </div>
                            <div className="pb-2 space-y-4 group">
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[11px] font-black text-slate-400">02</div>
                                    <p className="text-[15px] font-bold leading-relaxed tracking-tight pt-1 text-slate-700">
                                        Source of payment :
                                    </p>
                                </div>
                                <div className="pl-12">
                                    <div className="relative">
                                        <button
                                            type="button"
                                            disabled={!isActive}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const currentOpen = data?._dropdown_open === 'section2_q2';
                                                onChange('_dropdown_open', currentOpen ? '' : 'section2_q2');
                                            }}
                                            className={`w-full h-12 px-5 pr-10 rounded-2xl bg-white border flex items-center justify-between transition-all outline-none text-sm font-bold text-slate-700
                                                ${errors.includes('section2_q2') ? 'border-red-500 ring-4 ring-red-500/10' : 'border-slate-100 hover:border-indigo-200'}
                                                ${!isActive ? 'cursor-not-allowed' : 'cursor-pointer'}
                                            `}
                                        >
                                            <span className={!data?.section2_q2 ? 'text-slate-300 font-medium' : ''}>
                                                {data?.section2_q2 || 'Select source'}
                                            </span>
                                            <ChevronDown
                                                size={18}
                                                className={`text-slate-400 transition-transform duration-300 ${data?._dropdown_open === 'section2_q2' ? 'rotate-180 text-indigo-500' : ''}`}
                                            />
                                        </button>
                                        <AnimatePresence>
                                            {isActive && data?._dropdown_open === 'section2_q2' && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                                    className="absolute z-[100] top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden"
                                                >
                                                    <div className="py-2">
                                                        {['Peti cash', 'PO'].map((opt) => (
                                                            <button
                                                                key={opt}
                                                                type="button"
                                                                onClick={() => {
                                                                    onChange('section2_q2', opt);
                                                                    onChange('_dropdown_open', '');
                                                                }}
                                                                className={`w-full px-5 py-3 text-left text-sm font-bold transition-colors flex items-center justify-between
                                                                    ${data?.section2_q2 === opt ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-500'}
                                                                `}
                                                            >
                                                                {opt}
                                                                {data?.section2_q2 === opt && <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Signature Block */}
                <div className="mt-6 pt-6 border-t border-slate-50">
                    <div className="flex flex-col lg:flex-row gap-10">
                        {/* Signer Info */}
                        <div className="flex-1 space-y-6">
                            {signatureHeading && (
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="h-1.5 w-6 rounded-full bg-slate-200" />
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{signatureHeading}</h4>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {showName && (
                                    <div className="space-y-2">
                                        <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${errors.includes('signer_name') ? 'text-red-500' : 'text-slate-400'}`}>
                                            {(meta as any).nameLabel || 'Full Legal Name'} <span className="text-red-500">*</span>
                                        </label>
                                        {meta.staticName ? (
                                            <div className="w-full h-14 px-5 flex items-center rounded-2xl bg-slate-100 border border-slate-200 text-sm font-black text-slate-600">
                                                {meta.staticName}
                                            </div>
                                        ) : (
                                            <input
                                                type="text"
                                                disabled={!isActive}
                                                value={data?.signer_name || ''}
                                                onChange={(e) => onChange('signer_name', e.target.value)}
                                                placeholder="Enter full name"
                                                className={`w-full h-12 px-4 rounded-2xl bg-white border focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm font-bold text-slate-700
                                                    ${errors.includes('signer_name') ? 'border-red-500 bg-red-50/50' : 'border-slate-100'}
                                                `}
                                            />
                                        )}
                                    </div>
                                )}
                                {showDate && (
                                    <div className="space-y-2">
                                        <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${errors.includes('sign_date') ? 'text-red-500' : 'text-slate-400'}`}>
                                            Authentication Date <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            disabled={!isActive}
                                            value={data?.sign_date || ''}
                                            onChange={(e) => onChange('sign_date', e.target.value)}
                                            className={`w-full h-12 px-4 rounded-2xl bg-white border focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm font-bold text-slate-700
                                                ${errors.includes('sign_date') ? 'border-red-500 bg-red-50/50' : 'border-slate-100'}
                                            `}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Signature Pad Area */}
                        {showSignature && (
                            <div className="flex-1 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Pencil className={`h-4 w-4 ${errors.includes('signature') ? 'text-red-500' : 'text-indigo-500'}`} />
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${errors.includes('signature') ? 'text-red-500' : 'text-slate-400'}`}>
                                            Electronic Signature <span className="text-red-500">*</span>
                                        </span>
                                    </div>

                                    {isActive && (
                                        <div className="flex items-center gap-6">
                                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                                            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors">
                                                <Upload className="h-3.5 w-3.5" /> Upload Image
                                            </button>
                                            <button onClick={onClearSig} className="flex items-center gap-2 text-[10px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest transition-colors">
                                                <X className="h-3.5 w-3.5" /> Reset
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className={`relative h-[180px] rounded-[24px] overflow-hidden border-2 transition-all duration-500 
                                    ${errors.includes('signature') ? 'border-red-300 bg-red-50/30' :
                                        isActive ? 'bg-slate-50/50 border-dashed border-slate-200 hover:border-indigo-300' : 'bg-white border-transparent shadow-inner'}
                                `}>
                                    {isActive ? (
                                        uploadedSig ? (
                                            <div className="h-full flex items-center justify-center p-6 bg-white">
                                                <img src={uploadedSig} alt="Uploaded" className="max-h-full max-w-full opacity-80" />
                                            </div>
                                        ) : (
                                            <SignatureCanvas
                                                ref={sigRef}
                                                penColor="#0F172A"
                                                canvasProps={{ className: 'w-full h-full cursor-crosshair' }}
                                            />
                                        )
                                    ) : signature ? (
                                        <div className="h-full flex items-center justify-center p-6 bg-white/40">
                                            <img src={signature} alt="Signature" className="max-h-full max-w-full mix-blend-multiply opacity-90" />
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-2">
                                            <Lock className="h-8 w-8 opacity-20" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Awaiting Authorization</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
