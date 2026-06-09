import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface ThemeToggleProps {
    variant?: 'pill';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'pill' }) => {
    const { theme, toggleTheme } = useTheme();
    const isLight = theme === 'light';

    if (variant === 'pill') {
        return (
            <button
                onClick={toggleTheme}
                className={`relative w-[60px] h-[30px] rounded-full flex items-center p-1 transition-all duration-300 border
                    ${isLight ? 'bg-white border-gray-200' : 'bg-[#1a202c] border-white/10'}`}
                aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
                title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
            >
                <div className="flex justify-between items-center w-full px-1.5 pointer-events-none opacity-20">
                    <Sun size={14} className="text-white" />
                    <Moon size={14} className="text-gray-700" />
                </div>
                <div
                    className={`absolute w-[22px] h-[22px] rounded-full transition-all duration-300 shadow-sm flex items-center justify-center
                        ${isLight ? 'translate-x-0 bg-[#00B4D8]' : 'translate-x-[30px] bg-cyan-400'}`}
                >
                    {isLight ? (
                        <Sun size={12} className="text-white" strokeWidth={3} />
                    ) : (
                        <Moon size={12} className="text-[#0f172a]" strokeWidth={3} />
                    )}
                </div>
            </button>
        );
    }
};
