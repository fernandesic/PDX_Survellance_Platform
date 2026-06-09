import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react"
import { useToast } from "./ToastProvider";
import type { NewsResponse } from "@/types";
import { service } from "@/services";
import { useAuth } from "./AuthProvider";

interface NewsContextType {
  newsData: NewsResponse | undefined;
  loading: boolean;
  reloadNews: () => void;
}

const NewsContext = createContext<NewsContextType | null>(null);

export const NewsProvider = ({ children }: { children: ReactNode }) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [newsData, setNewsData] = useState<NewsResponse>();

  const loadNews = async () => {
    try {
      setLoading(true);
      const response = await service.news();
      setNewsData(response);
    } catch (error: any) {
      showToast(error?.message || "Error fetching news", "error", 5000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role !== 'supplier') {
      loadNews();
    }
  }, [user]);

  return (
    <NewsContext.Provider value={{ newsData, loading, reloadNews: loadNews }}>
      {children}
    </NewsContext.Provider>
  );
};

export const useNews = () => useContext(NewsContext)!;
