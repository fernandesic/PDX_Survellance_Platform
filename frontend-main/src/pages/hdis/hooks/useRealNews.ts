import { useQuery } from "@tanstack/react-query";
import { logger } from "@/utils/logger";

export interface RealNewsItem {
    id: string;
    title: string;
    summary: string;
    link: string;
    source: string;
    publishDate: Date;
    riskLevel: "critical" | "high" | "medium" | "low";
    pillar?: string;
}

// Use a CORS proxy so we can fetch real RSS feeds directly in the browser (works in dev and prod)
const CORS_PROXY = "https://api.codetabs.com/v1/proxy/?quest=";

const RSS_FEEDS = [
    {
        name: "ReliefWeb",
        url: `${CORS_PROXY}${encodeURIComponent("https://reliefweb.int/updates/rss.xml")}`,
    },
    {
        name: "UN News Africa",
        url: `${CORS_PROXY}${encodeURIComponent("https://news.un.org/feed/subscribe/en/news/region/africa/feed/rss.xml")}`,
    },
    {
        name: "AllAfrica Health",
        url: `${CORS_PROXY}${encodeURIComponent("https://allafrica.com/tools/headlines/rdf/health/headlines.rdf")}`,
    },
];

const AFRICA_KEYWORDS = [
    "africa", "african", "sahel",
    "kenya", "tanzania", "uganda", "ethiopia", "somalia", "south sudan",
    "rwanda", "burundi", "nigeria", "ghana", "senegal", "mali", "niger",
    "burkina faso", "guinea", "sierra leone", "cameroon", "chad",
    "south africa", "mozambique", "zimbabwe", "zambia", "malawi",
    "drc", "congo", "angola", "madagascar", "eritrea", "namibia",
    "botswana", "lesotho", "eswatini", "gabon", "togo", "benin",
];

const HEALTH_KEYWORDS = [
    "health", "disease", "outbreak", "epidemic", "cholera", "ebola",
    "malaria", "measles", "polio", "mpox", "hiv", "aids", "tuberculosis",
    "vaccine", "vaccination", "hospital", "clinic", "medical", "mortality",
    "infection", "virus", "quarantine", "humanitarian", "emergency",
    "crisis", "displacement", "refugee", "famine", "flood", "drought",
    "cyclone", "disaster", "nutrition", "sanitation", "water",
    "conflict", "violence", "attack", "military",
];

const PILLAR_KEYWORDS: Record<string, string[]> = {
    outbreak: ["outbreak", "epidemic", "pandemic", "ebola", "cholera", "measles", "polio", "mpox", "malaria", "dengue", "yellow fever", "virus", "infection"],
    conflict: ["conflict", "violence", "war", "attack", "military", "insecurity", "rebel", "insurgency", "armed", "fighting", "terrorist"],
    vaccine: ["vaccine", "vaccination", "immunization", "dose", "campaign", "jab", "vax"],
    policy: ["policy", "legislation", "government", "regulation", "law", "ministry", "cabinet", "council", "declaration", "treaty"],
    funding: ["funding", "donation", "grant", "finances", "money", "budget", "million", "billion", "dollars", "euros", "aid", "contribution"],
    workforce: ["workforce", "healthcare worker", "nurse", "doctor", "training", "human resources", "staff", "recruitment", "capacity building"],
    climate: ["climate", "flood", "drought", "cyclone", "storm", "rain", "weather", "environment", "global warming", "carbon", "natural disaster"],
    agreement: ["agreement", "partnership", "collaboration", "mou", "signed", "deal", "treaty", "cooperation", "joint initiative"],
    uhc: ["uhc", "universal health coverage", "health system", "insurance", "access", "quality", "coverage", "equity"],
    osl: ["osl", "logistics", "supply chain", "truck", "warehouse", "delivery", "transport", "cargo", "shipment", "distribution", "equipment"],
    surveillance: ["surveillance", "detection", "monitoring", "tracking", "early warning", "data collection", "reporting", "investigation"],
    laboratory: ["laboratory", "lab", "testing", "diagnostic", "sample", "sequencing", "pathogen", "specimen"],
};

const RISK_KEYWORDS: Record<string, string[]> = {
    critical: ["outbreak", "epidemic", "ebola", "cholera outbreak", "emergency declaration", "mass casualty"],
    high: ["conflict", "violence", "displacement", "famine", "crisis", "surge", "mpox", "flood", "cyclone"],
    medium: ["vaccination", "surveillance", "preparedness", "response", "capacity", "funding"],
    low: ["training", "partnership", "initiative", "progress", "milestone"],
};

function classifyPillar(text: string): string | undefined {
    const t = text.toLowerCase();
    // Prioritize pillars based on keyword density or first match
    for (const [pillar, keywords] of Object.entries(PILLAR_KEYWORDS)) {
        if (keywords.some((kw) => t.includes(kw))) return pillar;
    }
    return undefined;
}

function classifyRisk(text: string): RealNewsItem["riskLevel"] {
    const t = text.toLowerCase();
    for (const level of ["critical", "high", "medium", "low"] as const) {
        if (RISK_KEYWORDS[level].some((kw) => t.includes(kw))) return level;
    }
    return "low";
}

function isRelevant(title: string, summary: string): boolean {
    const combined = `${title} ${summary}`.toLowerCase();
    return AFRICA_KEYWORDS.some((kw) => combined.includes(kw));
}

function parseRSSDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}

function stripHTML(html: string): string {
    if (!html) return "";
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || "").trim();
}

function makeId(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}

function getTextContent(item: Element, tagName: string): string {
    // Try direct child first
    const el = item.querySelector(tagName);
    if (!el) return "";
    // For <link> tag, textContent may be empty in some parsers; try href attribute
    const text = el.textContent?.trim() || "";
    return text;
}

function getLinkHref(item: Element): string {
    // Try <link> text content first
    const linkEl = item.querySelector("link");
    if (linkEl) {
        const text = linkEl.textContent?.trim();
        if (text && text.startsWith("http")) return text;
        // Some feeds store link as href attribute
        const href = linkEl.getAttribute("href");
        if (href) return href;
    }
    // Try <guid> as fallback
    const guidEl = item.querySelector("guid");
    if (guidEl) {
        const text = guidEl.textContent?.trim();
        if (text && text.startsWith("http")) return text;
    }
    return "";
}

function getPubDate(item: Element): string {
    // Try common date element names
    const dateSelectors = ["pubDate", "date"];
    for (const sel of dateSelectors) {
        const el = item.querySelector(sel);
        if (el?.textContent) return el.textContent.trim();
    }
    // Try dc:date (namespaced)
    const allElements = item.getElementsByTagName("*");
    for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        if (el.localName === "date" || el.tagName === "dc:date") {
            if (el.textContent) return el.textContent.trim();
        }
    }
    return "";
}

async function fetchAndParseRSS(
    feedUrl: string,
    sourceName: string
): Promise<RealNewsItem[]> {
    try {
        const response = await fetch(feedUrl, {
            headers: { Accept: "application/xml, text/xml, application/rss+xml, */*" },
        });

        if (!response.ok) {
            logger.warn(`[useRealNews] ${sourceName}: HTTP ${response.status}`);
            return [];
        }

        const text = await response.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "text/xml");

        // Check for parse errors
        const parseError = xml.querySelector("parsererror");
        if (parseError) {
            logger.warn(`[useRealNews] ${sourceName}: XML parse error`);
            return [];
        }

        const items = xml.querySelectorAll("item");
        const results: RealNewsItem[] = [];
        const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;

        items.forEach((item) => {
            const title = getTextContent(item, "title");
            if (!title) return;

            const link = getLinkHref(item);
            const descEl = item.querySelector("description");
            const summary = stripHTML(descEl?.textContent || "").slice(0, 300);

            const pubDateStr = getPubDate(item);
            const pubDate = parseRSSDate(pubDateStr);

            // Skip if older than 3 days (if we have a date)
            if (pubDate && pubDate.getTime() < threeDaysAgo) return;

            // Skip if not relevant
            if (!isRelevant(title, summary)) return;

            results.push({
                id: makeId(link || title),
                title,
                summary,
                link,
                source: sourceName,
                publishDate: pubDate || new Date(),
                riskLevel: classifyRisk(`${title} ${summary}`),
                pillar: classifyPillar(`${title} ${summary}`),
            });
        });

        logger.log(`[useRealNews] ${sourceName}: ${results.length} articles from ${items.length} entries`);
        return results;
    } catch (err) {
        logger.warn(`[useRealNews] Failed to fetch ${sourceName}:`, err);
        return [];
    }
}

/**
 * Checks if two strings are substantially similar (60%+ word overlap).
 * Helps catch the same story reported by different sources with different titles.
 */
function areSimilar(text1: string, text2: string): boolean {
    const stopWords = new Set(["the", "and", "for", "with", "from", "that", "this", "africa", "african"]);
    const getWords = (s: string) => 
        new Set(s.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w)));
    
    const w1 = getWords(text1);
    const w2 = getWords(text2);
    if (w1.size === 0 || w2.size === 0) return false;

    let overlap = 0;
    w1.forEach(w => { if (w2.has(w)) overlap++; });

    const similarity = overlap / Math.min(w1.size, w2.size);
    return similarity > 0.6; // 60% overlap threshold
}

async function fetchAllFeeds(): Promise<RealNewsItem[]> {
    const feedPromises = RSS_FEEDS.map((feed) =>
        fetchAndParseRSS(feed.url, feed.name)
    );

    const results = await Promise.allSettled(feedPromises);
    const allItems: RealNewsItem[] = [];

    results.forEach((result) => {
        if (result.status === "fulfilled") {
            allItems.push(...result.value);
        }
    });

    // Sort by publish date (newest first)
    const sorted = allItems.sort((a, b) => b.publishDate.getTime() - a.publishDate.getTime());
    
    // Improved deduplication: title matching + similarity check
    const uniqueItems: RealNewsItem[] = [];
    
    for (const item of sorted) {
        const isDuplicate = uniqueItems.some(existing => 
            existing.title.toLowerCase().slice(0, 40) === item.title.toLowerCase().slice(0, 40) ||
            areSimilar(existing.title, item.title)
        );
        
        if (!isDuplicate) {
            uniqueItems.push(item);
        }
    }

    return uniqueItems.slice(0, 30);
}

export function useRealNews() {
    return useQuery({
        queryKey: ["real-news-feeds"],
        queryFn: fetchAllFeeds,
        refetchInterval: 5 * 60 * 1000,
        staleTime: 2 * 60 * 1000,
        retry: 2,
    });
}
