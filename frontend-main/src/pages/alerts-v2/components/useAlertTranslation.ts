import { useCallback, useEffect, useState } from 'react';
import {
  getCachedTranslation,
  translateText,
} from '@/pages/alerts/services/translationService';

export type TranslationView = 'original' | 'translated';

export interface UseAlertTranslationArgs {
  /** The text to translate — typically the card headline. */
  text: string;
  /** Source language code (ISO 639-1). Defaults to `en`. */
  sourceLang?: string;
  /** Target language code (ISO 639-1). Defaults to `en`. */
  targetLang?: string;
  /** Backend-provided translation (assumed to be in targetLang) if any. */
  initialTranslation?: string | null;
}

export interface UseAlertTranslationResult {
  canTranslate: boolean;
  translated: string | null;
  loading: boolean;
  error: boolean;
  view: TranslationView;
  translate: () => Promise<void>;
  showOriginal: () => void;
}

/**
 * Per-card translation state built on top of the shared MyMemory-backed
 * translation service. Starts in the "original" view and flips to "translated"
 * once a result is available (from cache, backend, or a live fetch).
 */
export function useAlertTranslation({
  text,
  sourceLang,
  targetLang,
  initialTranslation,
}: UseAlertTranslationArgs): UseAlertTranslationResult {
  const source = (sourceLang || 'en').toLowerCase();
  const target = (targetLang || 'en').toLowerCase();
  const canTranslate = Boolean(text) && source !== target && text.length >= 3;

  const cached = canTranslate ? getCachedTranslation(text, target, source) : null;
  const seed = initialTranslation || cached || null;

  const [translated, setTranslated] = useState<string | null>(seed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [view, setView] = useState<TranslationView>(seed ? 'translated' : 'original');

  // When the target language changes (user flips the feed-level picker),
  // drop any previous translation and reset to original until the user
  // clicks Translate again for the new target.
  useEffect(() => {
    const nextCached = canTranslate
      ? getCachedTranslation(text, target, source)
      : null;
    const nextSeed = initialTranslation || nextCached || null;
    setTranslated(nextSeed);
    setError(false);
    setView(nextSeed ? 'translated' : 'original');
  }, [canTranslate, initialTranslation, source, target, text]);

  const translate = useCallback(async () => {
    if (!canTranslate || loading) return;
    if (translated) {
      setView('translated');
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const result = await translateText(text, target, source);
      if (result && result !== text) {
        setTranslated(result);
        setView('translated');
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [canTranslate, loading, source, target, text, translated]);

  const showOriginal = useCallback(() => setView('original'), []);

  return { canTranslate, translated, loading, error, view, translate, showOriginal };
}
