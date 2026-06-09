import React, { useEffect, useState } from "react";
import { pami } from "@/pages/pami/services/pami";
import type { PAMIData } from "@/pages/pami/types/pami";
import { logger } from "@/utils/logger";
import { PAMIView } from "./PAMIView";

const PAMIPage: React.FC = () => {
    const [data, setData] = useState<PAMIData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const pamiData = await pami.getData();
                setData(pamiData);
            } catch (error) {
                logger.error("Error loading PAMI data:", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    return (
        <PAMIView 
            data={data}
            loading={loading}
        />
    );
};

export default PAMIPage;
