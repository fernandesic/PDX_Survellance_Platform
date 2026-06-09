import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
    className?: string;
}

export const BackButton = ({ className = "" }: BackButtonProps) => {
    const navigate = useNavigate();

    return (
        <button
            onClick={() => navigate("/hdis")}
            className={`group flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all hover:bg-white/5 active:scale-95 ${className}`}
            title="Back to Dashboard"
        >
            <ArrowLeft className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
        </button>
    );
};
