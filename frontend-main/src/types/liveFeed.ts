export interface LiveFeed {
  title: string;
  source: string;
  timeAgo: string;
  progress: number[];
  country?: string;
  headline?: string;
  priority?: string;
  summary?: string;
  original_text?: string;
  translated_text?: string;
  original_language?: string;
  reported_cases?: number;
  reported_deaths?: number;
  created_at?: string;
  publishedAt?: string;
}

export interface WatchItem {
  country: string;
  metric: string;
  value: number;
  change: number;
  trend: "up" | "down";
  bars: number[];
}

export interface DashboardResponse {
  liveFeed: LiveFeed[];
  watchlist: WatchItem[];
}
