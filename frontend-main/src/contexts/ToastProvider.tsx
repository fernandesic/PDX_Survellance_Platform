import React, { useState, useEffect, createContext, useContext } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { logger } from "@/utils/logger";


type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType, duration?: number) => void;
}


const ToastContext = createContext<ToastContextType | undefined>(undefined);


export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};


const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        handleRemove();
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration]);

  const handleRemove = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />;
      default:
        return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getStyles = () => {
    const baseStyles = "relative overflow-hidden backdrop-blur-sm border border-opacity-20 shadow-2xl";

    switch (toast.type) {
      case 'success':
        return `${baseStyles} bg-gradient-to-r from-emerald-900/90 to-emerald-800/90 border-emerald-500`;
      case 'error':
        return `${baseStyles} bg-gradient-to-r from-red-900/90 to-red-800/90 border-red-500`;
      case 'warning':
        return `${baseStyles} bg-gradient-to-r from-amber-900/90 to-amber-800/90 border-amber-500`;
      case 'info':
        return `${baseStyles} bg-gradient-to-r from-blue-900/90 to-blue-800/90 border-blue-500`;
      default:
        return `${baseStyles} bg-gradient-to-r from-gray-900/90 to-gray-800/90 border-gray-500`;
    }
  };

  return (
    <div
      className={`
        ${getStyles()}
        rounded-xl p-4 min-w-80 max-w-md mx-auto mb-3
        transform transition-all duration-300 ease-out
        ${isVisible && !isLeaving
          ? 'translate-y-0 opacity-100 scale-100'
          : isLeaving
            ? 'translate-y-2 opacity-0 scale-95'
            : '-translate-y-2 opacity-0 scale-95'
        }
        hover:scale-[1.02] hover:shadow-3xl
      `}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 rounded-xl" />

      <div className="relative flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-medium leading-relaxed text-sm">
            {toast.message}
          </p>
        </div>

        <button
          onClick={handleRemove}
          className="cursor-pointer flex-shrink-0 p-1 rounded-lg transition-all duration-200 hover:bg-white/10 group"
        >
          <X className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
        </button>
      </div>

      {toast.duration && toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 h-1 bg-white/20 rounded-b-xl overflow-hidden">
          <div
            className="h-full bg-white/60 rounded-b-xl"
            style={{
              animation: `progressShrink ${toast.duration}ms linear forwards`,
              width: '100%'
            }}
          />
        </div>
      )}
    </div>
  );
};

const ToastContainer: React.FC<{ toasts: Toast[]; onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 pointer-events-none z-50 w-full max-w-md px-4">
      <div className="flex flex-col items-center w-full">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto w-full">
            <ToastItem toast={toast} onRemove={onRemove} />
          </div>
        ))}
      </div>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: ToastType, duration: number = 4000) => {
    // Globally suppress connectivity/network error toasts (to avoid flooding when backend is down)
    const normalizedMsg = message.toLowerCase();
    const isConnectivityError = 
      normalizedMsg.includes('network error') || 
      normalizedMsg.includes('failed to fetch') || 
      normalizedMsg.includes('err_connection') ||
      normalizedMsg.includes('no response received');

    if (type === 'error' && isConnectivityError) {
      logger.warn('Suppressed connectivity error toast:', message);
      return;
    }

    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { id, message, type, duration };

    setToasts(prev => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <style>
        {`
          @keyframes progressShrink {
            from { width: 100%; }
            to { width: 0%; }
          }
        `}
      </style>
    </ToastContext.Provider>
  );
};