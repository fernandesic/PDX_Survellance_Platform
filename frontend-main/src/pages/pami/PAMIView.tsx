import React from "react";
import { PAMIMap } from "./components/PAMIMap";
import type { PAMIData } from "@/pages/pami/types/pami";
import { Loading } from "@/components/Loading";

interface PAMIViewProps {
    data: PAMIData | null;
    loading: boolean;
}

export const PAMIView: React.FC<PAMIViewProps> = ({ data, loading }) => {
    if (loading) {
        return <Loading />;
    }

    return (
        <div className="w-full h-screen p-6">
            <div className="w-full h-full rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
                {data && <PAMIMap locations={data.locations} />}
            </div>
        </div>
    );
};
