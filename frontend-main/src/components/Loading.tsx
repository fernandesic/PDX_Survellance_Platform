import { useTheme } from "@/contexts/ThemeContext";

export const Loading = () => {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    return (
        <div className="w-full h-full min-h-screen self-stretch flex flex-row items-center justify-center backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
                <img
                    src={isLight ? "/assets/logo/light-pdx-without-text.webp" : "/assets/logo/dark-pdx-without-text.webp"}
                    alt="PDX"
                    loading="eager"
                    fetchPriority="high"
                    className="w-32 h-auto object-contain rounded-md"
                    style={{
                        animation: 'breathe 2s ease-in-out infinite'
                    }}
                />
                <style>{`
                    @keyframes breathe {
                        0%, 100% {
                            transform: scale(1);
                            opacity: 0.6;
                        }
                        50% {
                            transform: scale(1.1);
                            opacity: 1;
                        }
                    }
                `}</style>
            </div>
        </div>
    )
}