import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

interface InputBoxProps {
    onSendMessage: (text: string) => void;
    disabled?: boolean;
}

export const InputBox: React.FC<InputBoxProps> = ({ onSendMessage, disabled = false }) => {
    const [inputValue, setInputValue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);


    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
        }
    }, [inputValue]);

    const handleSend = () => {
        if (disabled) return;
        const trimmedValue = inputValue.trim();
        if (trimmedValue) {
            onSendMessage(trimmedValue);
            setInputValue('');
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
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
        <div className="relative w-full max-w-3xl mx-auto">
            <div className={`
                relative flex items-end
                bg-[#f4f4f4] rounded-3xl
                border border-gray-200
                transition-all duration-200
                ${disabled ? 'opacity-60' : ''}
            `}>

                <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder={disabled ? "Please wait..." : "Ask anything"}
                    disabled={disabled}
                    className={`
                        flex-1 resize-none overflow-y-auto
                        text-[15px] text-gray-900 placeholder-gray-500
                        bg-transparent border-none outline-none
                        leading-6 py-3 pl-4 pr-2
                        ${disabled ? 'cursor-not-allowed' : ''}
                    `}
                    style={{ maxHeight: '200px' }}
                />


                <button
                    onClick={handleSend}
                    disabled={!hasText || disabled}
                    className={`
                        flex-shrink-0 m-2
                        w-8 h-8 rounded-full
                        flex items-center justify-center
                        transition-all duration-200
                        ${hasText && !disabled
                            ? 'bg-black hover:bg-gray-800 text-white cursor-pointer'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }
                    `}
                    title="Send message"
                >
                    <ArrowUp size={18} strokeWidth={2.5} />
                </button>
            </div>
        </div>
    );
};
