import { Loader2 } from "lucide-react"

export const Updating = () => {
    return (
            <div className="flex items-center gap-1">
                <Loader2 className="w-5 h-5 animate-spin" />
                <p className="text-sm">Updating...</p>
            </div>
        )
}