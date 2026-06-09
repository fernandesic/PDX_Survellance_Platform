import { useEffect } from "react";
import { useOverviewQuery } from "@/hooks/queries/useOverviewQuery";
import { useToast } from "@/contexts/ToastProvider";
import { useTheme } from "@/contexts/ThemeContext";
import OverviewView from "./OverviewView";

export default function OverviewPage() {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const { showToast } = useToast();

    const { data: overviewData, error } = useOverviewQuery();

    useEffect(() => {
        if (error) {
            showToast(error.message || "An Error Occurred while retrieving data", "error", 5000);
        }
    }, [error, showToast]);

    useEffect(() => {
        if (!document.getElementById('skeleton-breathe-style')) {
            const style = document.createElement('style');
            style.id = 'skeleton-breathe-style';
            style.textContent = `@keyframes skeleton-breathe { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.5; } }`;
            document.head.appendChild(style);
        }
    }, []);

    return (
        <OverviewView 
            overviewData={overviewData} 
            isLight={isLight} 
        />
    );
}
