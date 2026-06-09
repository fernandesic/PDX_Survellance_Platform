import React, { useEffect, useState } from 'react';
import { Clipboard, Check, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { logger } from "@/utils/logger";

interface Message {
    id: number;
    text: string;
    sender: 'user' | 'ai';
    ragUsed?: boolean;
    dataSources?: string[];
    timestamp?: Date;
}

interface MessageBubbleProps {
    message: Message;
    onEditMessage: (id: number, newText: string) => void;
    onRegenerate?: (id: number) => void;
}

const MessageActions = ({
    text,
    isUser,
    onRegenerate
}: {
    text: string;
    isUser: boolean;
    onRegenerate?: () => void;
}) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            logger.error('Failed to copy:', err);
        }
    };

    return (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
                onClick={handleCopy}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                title={copied ? "Copied!" : "Copy"}
            >
                {copied ? <Check size={16} /> : <Clipboard size={16} />}
            </button>
            {!isUser && onRegenerate && (
                <button
                    onClick={onRegenerate}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                    title="Regenerate response"
                >
                    <RotateCcw size={16} />
                </button>
            )}
        </div>
    );
};

const MarkdownContent = ({ content }: { content: string }) => {
    return (
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
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onEditMessage, onRegenerate }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 50);
        return () => clearTimeout(timer);
    }, []);

    const isUser = message.sender === 'user';

    const animationClasses = isVisible
        ? 'opacity-100 translate-y-0'
        : 'opacity-0 translate-y-2';

    if (isUser) {
        return (
            <div className={`flex justify-end mb-4 transition-all duration-300 ease-out ${animationClasses}`}>
                <div className="max-w-[70%]">
                    <div className="bg-[#2f2f2f] text-white px-4 py-2.5 rounded-3xl">
                        <p className="whitespace-pre-wrap leading-6 text-[15px]">{message.text}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`group mb-6 transition-all duration-300 ease-out ${animationClasses}`}>
            <div className="max-w-none">
                <div className="text-gray-800 text-[15px] leading-7">
                    <MarkdownContent content={message.text} />
                </div>

                <div className="mt-2">
                    <MessageActions
                        text={message.text}
                        isUser={false}
                        onRegenerate={onRegenerate ? () => onRegenerate(message.id) : undefined}
                    />
                </div>
            </div>
        </div>
    );
};
