import LpiPage from "./components/LpiPage";
import { useTheme } from "@/contexts/ThemeContext";

export default function OSLPage() {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    return (
        <div className={`w-full min-h-screen ${isLight ? 'bg-gray-50' : 'bg-[#090F1F]'}`}>
            <LpiPage />
        </div>
    );
}
