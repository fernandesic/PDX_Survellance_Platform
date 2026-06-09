import React, { useState, useEffect, useRef } from 'react';
import { InputBox } from './InputBox';
import { MessageBubble } from './MessageBubble';
import { X, Loader2, Heart, Shield, Users, BarChart3, Sun, Globe } from 'lucide-react';
import { chatService, SUPPORTED_LANGUAGES } from '@/pages/chat/services/chat_service';
import type { Language } from '@/pages/chat/services/chat_service';
import { logger } from "@/utils/logger";

interface Message {
    id: number;
    text: string;
    sender: 'user' | 'ai';
    confidence?: 'Low' | 'Medium' | 'High';
    isLoading?: boolean;
    isStreaming?: boolean;
    ragUsed?: boolean;
    dataSources?: string[];
    timestamp?: Date;
}

const initialMessages: Message[] = [];

interface ChatWindowProps {
    onClose: () => void;
}

const WelcomeSection = ({
    onQuestionSelect,
    isLoadingInBackground,
    onReturnToChat
}: {
    onQuestionSelect: (q: string) => void;
    isLoadingInBackground?: boolean;
    onReturnToChat?: () => void;
}) => {
    const examplePrompts = [
        { icon: Heart, text: "What are the high-risk hazards for Kenya?", color: "text-red-500", bg: "bg-red-50" },
        { icon: Shield, text: "What is the capacity score for Nigeria?", color: "text-blue-500", bg: "bg-blue-50" },
        { icon: Users, text: "CHW statistics for Ghana", color: "text-green-500", bg: "bg-green-50" },
        { icon: BarChart3, text: "IHR Capacities overview", color: "text-purple-500", bg: "bg-purple-50" },
    ];

    const popularTopics = [
        {
            title: "STAR Hazards",
            description: "Explore hazard risks, severity predictions, and country-specific risk trends.",
            icon: Heart,
            iconBg: "bg-gradient-to-br from-red-100 to-pink-100",
            iconColor: "text-red-600",
            action: "View Risks",
            hoverBorder: "hover:border-red-300",
            gradient: "from-red-50 to-pink-50"
        },
        {
            title: "IHR Capacities",
            description: "Check core capacity scores and compare preparedness across countries.",
            icon: Sun,
            iconBg: "bg-gradient-to-br from-yellow-100 to-amber-100",
            iconColor: "text-yellow-600",
            action: "View Scores",
            hoverBorder: "hover:border-yellow-300",
            gradient: "from-yellow-50 to-amber-50"
        },
    ];

    return (
        <div className="flex-1 overflow-y-auto p-6">
            {isLoadingInBackground && (
                <button
                    onClick={onReturnToChat}
                    className="w-full mb-6 p-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl flex items-center justify-center gap-3 transition-colors shadow-lg"
                >
                    <Loader2 className="animate-spin text-white" size={18} />
                    <span className="text-white font-medium">Generating response... Click to view</span>
                </button>
            )}

            <div className="flex items-start gap-4 mb-6">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-lg flex-shrink-0">
                    <img
                        src="/assets/logo-chat.png"
                        alt="Ask WHO"
                        className="w-12 h-12 object-contain"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = '<span class="text-white text-2xl font-bold">AI</span>';
                        }}
                    />
                </div>
                <div className="pt-2">
                    <p className="text-gray-600 text-lg">Hello!</p>
                    <h2 className="text-2xl font-bold text-gray-900">How can I help you?</h2>
                </div>
            </div>

            <div className="mb-8 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                <p className="text-gray-700 text-sm leading-relaxed">
                    I'm <span className="font-semibold text-indigo-600">Ask WHO</span>, your health intelligence assistant.
                    Ask me about hazards (STAR), capacities (IHR), readiness, or community health workers (CHW).
                </p>
            </div>

            <div className="space-y-3 mb-8">
                <p className="text-sm text-gray-500 mb-3">Try asking about:</p>
                {examplePrompts.map((prompt, index) => (
                    <button
                        key={index}
                        onClick={() => onQuestionSelect(prompt.text)}
                        disabled={isLoadingInBackground}
                        className={`w-full flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all duration-200 text-left group ${isLoadingInBackground ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <div className={`w-10 h-10 rounded-xl ${prompt.bg} flex items-center justify-center`}>
                            <prompt.icon size={20} className={prompt.color} />
                        </div>
                        <span className="text-gray-700 font-medium group-hover:text-indigo-600 transition-colors">
                            {prompt.text}
                        </span>
                    </button>
                ))}
            </div>

            <div>
                <p className="text-sm text-gray-500 mb-3">Popular Topics</p>
                <div className="grid grid-cols-2 gap-4">
                    {popularTopics.map((topic, index) => (
                        <button
                            key={index}
                            onClick={() => onQuestionSelect(`Tell me about ${topic.title}`)}
                            disabled={isLoadingInBackground}
                            className={`
                                group relative p-5 rounded-2xl text-left overflow-hidden
                                bg-gradient-to-br ${topic.gradient}
                                border border-white/60 backdrop-blur-sm
                                shadow-lg shadow-gray-200/50
                                hover:shadow-xl hover:scale-[1.02] ${topic.hoverBorder}
                                transition-all duration-300 ease-out
                                ${isLoadingInBackground ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                        >
                            <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/30 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />

                            <div className={`w-12 h-12 ${topic.iconBg} rounded-xl flex items-center justify-center mb-3 shadow-sm`}>
                                <topic.icon size={24} className={topic.iconColor} />
                            </div>

                            <p className="font-bold text-gray-900 text-base mb-1">{topic.title}</p>
                            <p className="text-xs text-gray-600 leading-relaxed mb-3">{topic.description}</p>

                            <span className={`text-xs font-semibold ${topic.iconColor} group-hover:underline flex items-center gap-1`}>
                                {topic.action}
                                <span className="group-hover:translate-x-1 transition-transform">→</span>
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export const ChatWindow: React.FC<ChatWindowProps> = ({ onClose }) => {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [isLoading, setIsLoading] = useState(false);
    const [showWelcome, setShowWelcome] = useState(true);
    const [selectedLanguage, setSelectedLanguage] = useState<Language>(() => {
        const saved = localStorage.getItem('askwho_language');
        if (saved === 'auto') return 'en';
        return (saved as Language) || 'en';
    });
    const [showLanguageMenu, setShowLanguageMenu] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const languageMenuRef = useRef<HTMLDivElement>(null);
    const hasMessages = messages.length > 0;


    useEffect(() => {
        localStorage.setItem('askwho_language', selectedLanguage);
    }, [selectedLanguage]);


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (languageMenuRef.current && !languageMenuRef.current.contains(event.target as Node)) {
                setShowLanguageMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        chatService.warmup().catch(() => {
            logger.log('[Chat] Model warmup failed - first query may be slow');
        });
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (text: string) => {
        if (!text.trim() || isLoading) return;

        setShowWelcome(false);

        const userMessage: Message = {
            id: Date.now(),
            text: text,
            sender: 'user',
            timestamp: new Date()
        };
        setMessages((prev) => [...prev, userMessage]);

        const aiMessageId = Date.now() + 1;
        setMessages((prev) => [...prev, {
            id: aiMessageId,
            text: "",
            sender: 'ai',
            isStreaming: true,
            timestamp: new Date()
        }]);
        setIsLoading(true);

        try {
            const contextType = chatService.detectContextType(text);

            let fullResponse = '';

            const history = messages
                .filter(msg => !msg.isLoading && !msg.isStreaming && msg.text)
                .slice(-10)
                .map(msg => ({
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: msg.text
                }));

            await chatService.queryStream(
                text,
                contextType,
                (chunk: string) => {
                    fullResponse += chunk;
                    setMessages((prev) => prev.map(msg =>
                        msg.id === aiMessageId
                            ? { ...msg, text: fullResponse, isStreaming: true }
                            : msg
                    ));
                },
                (metadata) => {
                    setMessages((prev) => prev.map(msg =>
                        msg.id === aiMessageId
                            ? {
                                ...msg,
                                isStreaming: false,
                                confidence: 'Medium',
                                ragUsed: metadata?.rag_used,
                                dataSources: metadata?.data_sources
                            }
                            : msg
                    ));
                    setIsLoading(false);
                },
                (error: Error) => {
                    setMessages((prev) => prev.map(msg =>
                        msg.id === aiMessageId
                            ? { ...msg, text: `⚠️ ${error.message}`, isStreaming: false }
                            : msg
                    ));
                    setIsLoading(false);
                },
                history,
                selectedLanguage
            );
        } catch (error: any) {
            const errorMessage = error?.message || 'Failed to get response. Make sure Ollama is running.';
            setMessages((prev) => prev.map(msg =>
                msg.id === aiMessageId
                    ? { ...msg, text: `⚠️ ${errorMessage}`, isStreaming: false }
                    : msg
            ));
            setIsLoading(false);
        }
    };

    const handleEditMessage = (id: number, newText: string) => {
        setMessages((prevMessages) =>
            prevMessages.map(msg =>
                msg.id === id ? { ...msg, text: newText } : msg
            )
        );
    };

    const handleReturnToChat = () => {
        setShowWelcome(false);
    };

    const shouldShowWelcome = showWelcome || !hasMessages;
    const isLoadingInBackground = isLoading && showWelcome && hasMessages;

    return (
        <div className="flex flex-col h-full w-full bg-gradient-to-b from-gray-50 to-white">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <img src="/assets/logo-chat.png" alt="" className="w-6 h-6" />
                <h1 className="text-lg font-semibold text-gray-800">
                    {shouldShowWelcome ? 'Ask WHO' : 'New Chat'}
                </h1>
                <button
                    onClick={onClose}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-full transition"
                    aria-label="Close"
                >
                    <X size={20} />
                </button>
            </div>

            {shouldShowWelcome ? (
                <WelcomeSection
                    onQuestionSelect={handleSendMessage}
                    isLoadingInBackground={isLoadingInBackground}
                    onReturnToChat={handleReturnToChat}
                />
            ) : (
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.map(msg => (
                        <div key={msg.id} className="flex items-start gap-2">
                            {msg.isLoading ? (
                                <div className="flex items-center gap-3 text-gray-500">
                                    <img
                                        src="/assets/WHO Insight AI.gif"
                                        alt="Loading"
                                        className="w-8 h-8 object-contain"
                                    />
                                    <span className="italic">{msg.text}</span>
                                </div>
                            ) : msg.isStreaming ? (
                                <div className="flex-1">
                                    <MessageBubble
                                        message={msg}
                                        onEditMessage={handleEditMessage}
                                    />
                                </div>
                            ) : (
                                <MessageBubble
                                    message={msg}
                                    onEditMessage={handleEditMessage}
                                />
                            )}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            )}

            <div className="p-6 pt-4 border-t border-white/50 bg-white/50 backdrop-blur-lg">
                <InputBox onSendMessage={handleSendMessage} disabled={isLoading} />
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mt-3">
                    <span>Ask WHO • Powered by Llama 3.2</span>
                    <span className="text-gray-300">|</span>
                    <div className="relative" ref={languageMenuRef}>
                        <button
                            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                            className="flex items-center gap-1 hover:text-indigo-600 transition-colors"
                            title="Change response language"
                        >
                            <Globe size={12} />
                            <span>{SUPPORTED_LANGUAGES[selectedLanguage]}</span>
                        </button>
                        {showLanguageMenu && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px] z-50">
                                {(Object.entries(SUPPORTED_LANGUAGES) as [Language, string][]).map(([code, name]) => (
                                    <button
                                        key={code}
                                        onClick={() => {
                                            setSelectedLanguage(code);
                                            setShowLanguageMenu(false);
                                        }}
                                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 transition-colors ${selectedLanguage === code ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-gray-700'
                                            }`}
                                    >
                                        {name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
