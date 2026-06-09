import { ChevronRight } from "lucide-react";

interface SectionHeaderProps {
    title?: string;
    action?: () => void;
    actionLabel?: string;
}

export function SectionHeader({ title, action, actionLabel }: SectionHeaderProps) {
    if (!title && !action) return null;
    return (
        <div className="flex items-center justify-between mb-4">
            {title && (
                <h3 className="font-mono text-sm font-bold text-foreground tracking-widest uppercase">{title}</h3>
            )}
            {action && (
                <button onClick={action} className="font-mono text-sm text-primary hover:underline flex items-center gap-0.5">
                    {actionLabel || "View all"} <ChevronRight className="h-3 w-3" />
                </button>
            )}
        </div>
    );
}
