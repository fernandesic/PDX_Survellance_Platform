import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { InputBox } from '@/pages/chat/components/InputBox';
import { MessageBubble } from '@/pages/chat/components/MessageBubble';
import { Loader2, Heart, Shield, Users, BarChart3, Plus, Globe } from 'lucide-react';
import { chatService, SUPPORTED_LANGUAGES } from '@/pages/chat/services/chat_service';
import type { Language, ContextType } from '@/pages/chat/services/chat_service';
import { logger } from "@/utils/logger";

const THINKING_TEXTS = [
  "Thinking",
  "Analyzing data",
  "Processing",
  "Searching knowledge",
  "Formulating response"
];

const ThinkingIndicator = () => {
  const [textIndex, setTextIndex] = useState(0);
  const [dots, setDots] = useState('');

  useEffect(() => {
    const textInterval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % THINKING_TEXTS.length);
    }, 2000);

    const dotsInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);

    return () => {
      clearInterval(textInterval);
      clearInterval(dotsInterval);
    };
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
  originalPrompt?: string;
}

const ChatPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [climateContext, setClimateContext] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('askwho_language');
    if (saved === 'auto') return 'en';
    return (saved as Language) || 'en';
  });
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const prefillProcessedRef = useRef(false);
  const hasMessages = messages.length > 0;

  // Save language preference
  useEffect(() => {
    localStorage.setItem('askwho_language', selectedLanguage);
  }, [selectedLanguage]);

  // Close language menu when clicking outside
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

  // Handle prefilled messages from navigation state (e.g., from Climate Dashboard "Ask AI")
  useEffect(() => {
    if (prefillProcessedRef.current) return;

    // Read from navigation state (passed from HazardPanel)
    const state = location.state as { prefill?: string; context?: string; climateData?: string } | null;

    if (state?.prefill && !hasMessages) {
      prefillProcessedRef.current = true;

      // Store climate context if provided
      if (state.climateData) {
        setClimateContext(state.climateData);
      }

      // Clear the navigation state to prevent re-triggering on refresh
      navigate(location.pathname, { replace: true, state: null });

      // Auto-send the prefilled message with climate context
      const contextType = (state.context as ContextType) || chatService.detectContextType(state.prefill!);

      // Small delay to ensure component is mounted
      setTimeout(() => {
        sendMessageToAIWithContext(state.prefill!, contextType, state.climateData);
      }, 100);
    }
  }, [location.state, hasMessages]);

  // Enhanced send function that accepts context override (for climate prefill)
  const sendMessageToAIWithContext = async (text: string, contextTypeOverride?: ContextType, contextData?: string, regenerateId?: number) => {
    if (!text.trim() || isLoading) return;

    let aiMessageId: number;

    if (regenerateId) {
      aiMessageId = regenerateId;
      setMessages((prev) => prev.map(msg =>
        msg.id === regenerateId
          ? { ...msg, text: "", isStreaming: true }
          : msg
      ));
    } else {
      const userMessage: Message = {
        id: Date.now(),
        text: text,
        sender: 'user',
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, userMessage]);

      aiMessageId = Date.now() + 1;
      setMessages((prev) => [...prev, {
        id: aiMessageId,
        text: "",
        sender: 'ai',
        isStreaming: true,
        timestamp: new Date(),
        originalPrompt: text
      }]);
    }

    setIsLoading(true);

    try {
      // Use override if provided, otherwise detect from message
      const contextType = contextTypeOverride || chatService.detectContextType(text);

      // If we have climate context data, prepend it to the message for the LLM
      const messageWithContext = contextData
        ? `${text}\n\n---\nCONTEXT DATA:\n${contextData}`
        : text;

      let fullResponse = '';

      const history = messages
        .filter(msg => !msg.isLoading && !msg.isStreaming && msg.text && msg.id !== regenerateId)
        .slice(-10)
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        }));

      await chatService.queryStream(
        messageWithContext,
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

  // Simple wrapper for regular message sends (without context override)
  const sendMessageToAI = (text: string, regenerateId?: number) => {
    sendMessageToAIWithContext(text, undefined, undefined, regenerateId);
  };

  const handleSendMessage = (text: string) => {
    sendMessageToAI(text);
  };

  const handleRegenerate = (messageId: number) => {
    const aiMessage = messages.find(msg => msg.id === messageId);
    if (aiMessage?.originalPrompt) {
      sendMessageToAI(aiMessage.originalPrompt, messageId);
    } else {
      const messageIndex = messages.findIndex(msg => msg.id === messageId);
      if (messageIndex > 0) {
        const previousUserMessage = messages.slice(0, messageIndex).reverse().find(msg => msg.sender === 'user');
        if (previousUserMessage) {
          sendMessageToAI(previousUserMessage.text, messageId);
        }
      }
    }
  };

  const handleEditMessage = (id: number, newText: string) => {
    setMessages((prevMessages) =>
      prevMessages.map(msg =>
        msg.id === id ? { ...msg, text: newText } : msg
      )
    );
  };

  const handleNewChat = () => {
    setMessages([]);
  };

  const examplePrompts = [
    { icon: Heart, text: "What are the high-risk hazards for Kenya?" },
    { icon: Shield, text: "What is the capacity score for Nigeria?" },
    { icon: Users, text: "CHW statistics for Ghana" },
    { icon: BarChart3, text: "IHR Capacities overview" },
  ];

  return (
    <div className="flex flex-col h-screen w-full bg-white">

      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-base font-medium text-gray-800">Ask WHO</span>
        </div>

        {hasMessages && (
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Plus size={16} />
            <span>New chat</span>
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-center h-full px-6">
            <div className="max-w-2xl w-full text-center">
              <h1 className="text-2xl font-medium text-gray-900 mb-8">
                What can I help with?
              </h1>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {examplePrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handleSendMessage(prompt.text)}
                    className="group flex items-start gap-3 p-4 rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all duration-200 text-left"
                  >
                    <prompt.icon size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600 text-sm leading-relaxed">
                      {prompt.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-8">
            {messages.map(msg => (
              <div key={msg.id}>
                {msg.isLoading ? (
                  <div className="flex items-center gap-2 text-gray-400 mb-4">
                    <Loader2 className="animate-spin" size={16} />
                    <span className="italic text-sm">{msg.text}</span>
                  </div>
                ) : msg.isStreaming && !msg.text ? (
                  <ThinkingIndicator />
                ) : (
                  <MessageBubble
                    message={msg}
                    onEditMessage={handleEditMessage}
                    onRegenerate={msg.sender === 'ai' ? handleRegenerate : undefined}
                  />
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="py-4 px-4 bg-white">
        <InputBox onSendMessage={handleSendMessage} disabled={isLoading} />
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mt-3">
          <span>Ask WHO can make mistakes. Check important info.</span>
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

export default ChatPage;
