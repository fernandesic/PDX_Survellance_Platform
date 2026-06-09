import { createContext, useContext } from "react";
import type { ReactNode } from "react"
import useLiveFeedWatchlist from "@/hooks/useLiveFeedWatchlist";
import type { DashboardResponse } from "@/types/liveFeed";
import type { FreshnessStatus } from "@/utils/signalCacheManager";

interface LiveFeedWatchlistContextType {
  data: DashboardResponse | null;
  loading: boolean;
  error: string | null;
  refreshData: () => void;
  forceUpdate: number;
  freshness: FreshnessStatus;
  cacheAgeLabel: string;
}

const LiveFeedWatchlistContext = createContext<LiveFeedWatchlistContextType | undefined>(undefined);

export const LiveFeedWatchlistProvider = ({ children }: { children: ReactNode }) => {
  const { data, loading, error, refreshData, forceUpdate, freshness, cacheAgeLabel } = useLiveFeedWatchlist();

  return (
    <LiveFeedWatchlistContext.Provider value={{ data, loading, error, refreshData, forceUpdate, freshness, cacheAgeLabel }}>
      {children}
    </LiveFeedWatchlistContext.Provider>
  );
};

export const useLiveFeedWatchlistContext = () => {
  const context = useContext(LiveFeedWatchlistContext);
  if (!context) {
    throw new Error("useLiveFeedWatchlistContext must be used inside LiveFeedWatchlistProvider");
  }
  return context;
};
