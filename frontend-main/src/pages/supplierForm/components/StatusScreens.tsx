import React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

export const LoadingScreen: React.FC<{ text: string }> = ({ text }) => (
    <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column' as const,
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e9f2 100%)',
    }}>
        <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
            boxShadow: '0 8px 30px rgba(59,130,246,0.3)',
        }}>
            <Loader2 style={{ width: 24, height: 24, color: '#fff' }} className="animate-spin" />
        </div>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.15em' }}>{text}</p>
    </div>
);

export const ErrorScreen: React.FC<{ error: string; onBack: () => void }> = ({ error, onBack }) => (
    <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e9f2 100%)', padding: 16,
    }}>
        <div style={{
            maxWidth: 400, width: '100%', background: '#fff', borderRadius: 24, padding: 40,
            boxShadow: '0 8px 30px rgba(0,0,0,0.08)', textAlign: 'center' as const,
        }}>
            <div style={{
                width: 64, height: 64, borderRadius: '50%', background: '#fef2f2',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
            }}>
                <AlertCircle style={{ width: 32, height: 32, color: '#ef4444' }} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: '0 0 8px' }}>Access Link Expired</h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px', lineHeight: 1.6 }}>{error}</p>
            <button onClick={onBack} style={{
                width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg, #1e293b, #0f172a)', color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(15,23,42,0.2)',
            }}>
                Return to Login
            </button>
        </div>
    </div>
);
