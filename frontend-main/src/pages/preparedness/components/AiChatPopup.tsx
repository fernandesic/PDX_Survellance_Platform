import React, { useState, useEffect, useRef } from 'react';
import { Loader2, FileText, Search, AlertCircle, Users, X, ArrowUp, Plus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TokenManager } from '@/lib/api';

const MarkdownContent = ({ content }: { content: string }) => (
    <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
            h1: ({ children }) => <h1 className="text-xl font-semibold text-gray-900 mt-4 mb-2">{children}</h1>,
            h2: ({ children }) => <h2 className="text-lg font-semibold text-gray-900 mt-3 mb-2">{children}</h2>,
            h3: ({ children }) => <h3 className="text-base font-semibold text-gray-900 mt-3 mb-1">{children}</h3>,
            p: ({ children }) => <p className="mb-3 last:mb-0 leading-7">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            em: ({ children }) => <em className="italic">{children}</em>,
            ul: ({ children }) => <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>,
            li: ({ children }) => <li className="leading-7">{children}</li>,
            code: ({ children, className }) => {
                const isInline = !className;
                return isInline ? (
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">{children}</code>
                ) : (
                    <code className="block bg-[#1e1e1e] text-gray-100 p-4 rounded-lg text-sm font-mono my-3 overflow-x-auto">{children}</code>
                );
            },
            pre: ({ children }) => <pre className="bg-[#1e1e1e] rounded-lg my-3 overflow-x-auto">{children}</pre>,
            table: ({ children }) => (
                <div className="overflow-x-auto my-3">
                    <table className="min-w-full border-collapse text-sm">{children}</table>
                </div>
            ),
            thead: ({ children }) => <thead className="bg-gray-50 border-b">{children}</thead>,
            tbody: ({ children }) => <tbody className="divide-y divide-gray-200">{children}</tbody>,
            tr: ({ children }) => <tr>{children}</tr>,
            th: ({ children }) => <th className="px-4 py-2 text-left font-semibold text-gray-700">{children}</th>,
            td: ({ children }) => <td className="px-4 py-2 text-gray-600">{children}</td>,
            blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-gray-300 pl-4 my-3 text-gray-600">{children}</blockquote>
            ),
            hr: () => <hr className="my-4 border-gray-200" />,
            a: ({ href, children }) => (
                <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>
            ),
        }}
    >
        {content}
    </ReactMarkdown>
);

const THINKING_TEXTS = ["Thinking", "Analyzing reports", "Processing data", "Summarizing"];
const ThinkingIndicator = () => {
    const [textIndex, setTextIndex] = useState(0);
    const [dots, setDots] = useState('');
    useEffect(() => {
        const t = setInterval(() => setTextIndex(p => (p + 1) % THINKING_TEXTS.length), 2000);
        const d = setInterval(() => setDots(p => (p.length >= 3 ? '' : p + '.')), 400);
        return () => { clearInterval(t); clearInterval(d); };
    }, []);

    return (
        <div className="mb-6">
            <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="animate-spin" size={16} />
                <span className="text-sm">{THINKING_TEXTS[textIndex]}{dots}</span>
            </div>
        </div>
    );
};

interface AiMessage {
    id: number;
    text: string;
    sender: 'user' | 'ai';
    isStreaming?: boolean;
    timestamp?: Date;
    originalPrompt?: string;
}

const AI_SUGGESTIONS = [
    { icon: FileText, text: "Summarize all reports from this week" },
    { icon: Search, text: "What are the key achievements across the team?" },
    { icon: AlertCircle, text: "Are there any gaps or areas needing attention?" },
    { icon: Users, text: "Compare progress across team members" },
];

function AiChatPopup({ onClose }: { onClose: () => void }) {
    const [messages, setMessages] = useState<AiMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const hasMessages = messages.length > 0;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
        }
    }, [inputValue]);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const handleSend = async (text?: string) => {
        const msg = text || inputValue.trim();
        if (!msg || isLoading) return;
        setInputValue('');

        const userMsg: AiMessage = { id: Date.now(), text: msg, sender: 'user', timestamp: new Date() };
        const aiMsgId = Date.now() + 1;
        setMessages(prev => [...prev, userMsg, { id: aiMsgId, text: '', sender: 'ai', isStreaming: true, timestamp: new Date(), originalPrompt: msg }]);
        setIsLoading(true);

        try {
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
            const token = TokenManager.getAccessToken();
            const history = messages
                .filter(m => !m.isStreaming && m.text)
                .slice(-10)
                .map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));

            const response = await fetch(`${API_BASE_URL}/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    message: msg,
                    context_type: 'preparedness',
                    conversation_history: history,
                    language: 'en'
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();
            let buffer = '';
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop() || '';
                for (const part of parts) {
                    for (const line of part.split('\n')) {
                        if (line.startsWith('data: ')) {
                            const content = line.slice(6);
                            if (content === '[DONE]') break;
                            try {
                                const decoded = JSON.parse(content);
                                if (decoded?.type === 'metadata') continue;
                                fullResponse += decoded;
                            } catch {
                                fullResponse += content;
                            }
                            setMessages(prev => prev.map(m =>
                                m.id === aiMsgId ? { ...m, text: fullResponse, isStreaming: true } : m
                            ));
                        }
                    }
                }
            }
            setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, isStreaming: false } : m
            ));
        } catch (err: any) {
            setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, text: `⚠️ ${err.message || 'Failed to get response'}`, isStreaming: false } : m
            ));
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const hasText = inputValue.trim().length > 0;

    return (
        <>
            {/* Overlay */}
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />

            {/* Centered Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                <div
                    ref={modalRef}
                    className="pointer-events-auto w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                    style={{ maxHeight: '130vh', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
                >
                    {/* ── Header ── */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full overflow-hidden bg-[#1a2332] flex items-center justify-center shadow-sm">
                                <img src="/assets/logo-chat.png" alt="Ask WHO" className="w-6 h-6 object-contain" />
                            </div>
                            <div>
                                <span className="text-base font-semibold text-gray-800">Ask WHO</span>
                                <span className="text-[11px] text-gray-400 ml-2">Preparedness Reports</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {hasMessages && (
                                <button
                                    onClick={() => setMessages([])}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <Plus size={16} />
                                    <span>New chat</span>
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* ── Body ── */}
                    <div className="flex-1 overflow-y-auto">
                        {!hasMessages ? (
                            /* Welcome — matches Ask WHO tab layout */
                            <div className="flex flex-col items-center justify-center h-full px-6 py-14">
                                <h2 className="text-2xl font-medium text-gray-900 mb-8">
                                    What can I help with?
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left w-full max-w-lg">
                                    {AI_SUGGESTIONS.map((s, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSend(s.text)}
                                            className="group flex items-start gap-3 p-4 rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all duration-200 text-left"
                                        >
                                            <s.icon size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
                                            <span className="text-gray-600 text-sm leading-relaxed">
                                                {s.text}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            /* Messages */
                            <div className="max-w-3xl mx-auto px-6 py-8">
                                {messages.map(msg => (
                                    <div key={msg.id}>
                                        {msg.sender === 'user' ? (
                                            <div className="flex justify-end mb-4">
                                                <div className="max-w-[75%]">
                                                    <div className="bg-[#2f2f2f] text-white px-4 py-2.5 rounded-3xl">
                                                        <p className="whitespace-pre-wrap leading-6 text-[15px]">{msg.text}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : msg.isStreaming && !msg.text ? (
                                            <ThinkingIndicator />
                                        ) : (
                                            <div className="group mb-6">
                                                <div className="max-w-none">
                                                    <div className="text-gray-800 text-[15px] leading-7">
                                                        <MarkdownContent content={msg.text} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {/* ── Input — matches Ask WHO InputBox style ── */}
                    <div className="py-4 px-6 bg-white border-t border-gray-100">
                        <div className="relative w-full max-w-3xl mx-auto">
                            <div className={`relative flex items-end bg-[#f4f4f4] rounded-3xl border border-gray-200 transition-all duration-200 ${isLoading ? 'opacity-60' : ''}`}>
                                <textarea
                                    ref={textareaRef}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    rows={1}
                                    placeholder={isLoading ? "Please wait..." : "Ask anything"}
                                    disabled={isLoading}
                                    className="flex-1 resize-none overflow-y-auto text-[15px] text-gray-900 placeholder-gray-500 bg-transparent border-none outline-none leading-6 py-3 pl-4 pr-2"
                                    style={{ maxHeight: '200px' }}
                                />
                                <button
                                    onClick={() => handleSend()}
                                    disabled={!hasText || isLoading}
                                    className={`flex-shrink-0 m-2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200
                                        ${hasText && !isLoading
                                            ? 'bg-black hover:bg-gray-800 text-white cursor-pointer'
                                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        }`}
                                    title="Send message"
                                >
                                    <ArrowUp size={18} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mt-3">
                            <span>Ask WHO can make mistakes. Check important info.</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default AiChatPopup;
