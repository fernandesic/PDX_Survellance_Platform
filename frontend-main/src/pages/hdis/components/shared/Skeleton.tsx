export function Skeleton({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse rounded-lg bg-secondary/60 ${className}`} />;
}

export function CardSkeleton({ lines = 3, className = "" }: { lines?: number; className?: string }) {
    return (
        <div className={`rounded-xl border border-border/30 bg-card p-5 space-y-3 ${className}`}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-32" />
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton key={i} className={`h-3 ${i === 0 ? "w-full" : i === 1 ? "w-3/4" : "w-1/2"}`} />
            ))}
        </div>
    );
}

export function ListSkeleton({ items = 4 }: { items?: number }) {
    return (
        <div className="rounded-xl border border-border/30 bg-card overflow-hidden">
            <div className="border-b border-border/30 px-5 py-3">
                <Skeleton className="h-3 w-32" />
            </div>
            <div className="divide-y divide-border/30">
                {Array.from({ length: items }).map((_, i) => (
                    <div key={i} className="px-5 py-3 flex gap-3">
                        <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-3 w-3/4" />
                            <Skeleton className="h-2.5 w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
