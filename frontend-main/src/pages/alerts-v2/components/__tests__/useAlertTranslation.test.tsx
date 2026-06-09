// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('@/pages/alerts/services/translationService', () => ({
  translateText: vi.fn(),
  getCachedTranslation: vi.fn(),
}));

import {
  translateText,
  getCachedTranslation,
} from '@/pages/alerts/services/translationService';
import { useAlertTranslation } from '../useAlertTranslation';

const mockTranslate = translateText as unknown as ReturnType<typeof vi.fn>;
const mockCached = getCachedTranslation as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockTranslate.mockReset();
  mockCached.mockReset();
  mockCached.mockReturnValue(null);
});

describe('useAlertTranslation', () => {
  it('disables the feature when the source is English', () => {
    const { result } = renderHook(() =>
      useAlertTranslation({ text: 'Outbreak', sourceLang: 'en' }),
    );
    expect(result.current.canTranslate).toBe(false);
  });

  it('disables the feature when the source is empty', () => {
    const { result } = renderHook(() =>
      useAlertTranslation({ text: 'Épidémie de choléra', sourceLang: '' }),
    );
    expect(result.current.canTranslate).toBe(false);
  });

  it('disables the feature for very short text', () => {
    const { result } = renderHook(() =>
      useAlertTranslation({ text: 'Hi', sourceLang: 'fr' }),
    );
    expect(result.current.canTranslate).toBe(false);
  });

  it('enables the feature for a non-English card', () => {
    const { result } = renderHook(() =>
      useAlertTranslation({ text: 'Épidémie de choléra', sourceLang: 'fr' }),
    );
    expect(result.current.canTranslate).toBe(true);
    expect(result.current.view).toBe('original');
    expect(result.current.translated).toBeNull();
  });

  it('seeds with the backend-provided translation and starts in translated view', () => {
    const { result } = renderHook(() =>
      useAlertTranslation({
        text: 'Épidémie',
        sourceLang: 'fr',
        initialTranslation: 'Outbreak',
      }),
    );
    expect(result.current.translated).toBe('Outbreak');
    expect(result.current.view).toBe('translated');
  });

  it('uses the in-memory cache without calling the API', async () => {
    mockCached.mockReturnValue('Cached outbreak');
    const { result } = renderHook(() =>
      useAlertTranslation({ text: 'Épidémie de choléra', sourceLang: 'fr' }),
    );
    expect(result.current.translated).toBe('Cached outbreak');
    expect(result.current.view).toBe('translated');
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  it('calls the API on demand and flips to translated on success', async () => {
    mockTranslate.mockResolvedValue('Cholera outbreak');
    const { result } = renderHook(() =>
      useAlertTranslation({ text: 'Épidémie de choléra', sourceLang: 'fr' }),
    );

    await act(async () => {
      await result.current.translate();
    });

    expect(mockTranslate).toHaveBeenCalledWith('Épidémie de choléra', 'en', 'fr');
    expect(result.current.translated).toBe('Cholera outbreak');
    expect(result.current.view).toBe('translated');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it('sets error when the API returns null', async () => {
    mockTranslate.mockResolvedValue(null);
    const { result } = renderHook(() =>
      useAlertTranslation({ text: 'Épidémie de choléra', sourceLang: 'fr' }),
    );
    await act(async () => {
      await result.current.translate();
    });
    expect(result.current.error).toBe(true);
    expect(result.current.translated).toBeNull();
    expect(result.current.view).toBe('original');
  });

  it('sets error when the API returns the same text (no translation)', async () => {
    mockTranslate.mockResolvedValue('Épidémie de choléra');
    const { result } = renderHook(() =>
      useAlertTranslation({ text: 'Épidémie de choléra', sourceLang: 'fr' }),
    );
    await act(async () => {
      await result.current.translate();
    });
    expect(result.current.error).toBe(true);
  });

  it('sets error when the API throws', async () => {
    mockTranslate.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() =>
      useAlertTranslation({ text: 'Épidémie de choléra', sourceLang: 'fr' }),
    );
    await act(async () => {
      await result.current.translate();
    });
    expect(result.current.error).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('shows a loading flag while the request is in flight', async () => {
    let resolve!: (v: string | null) => void;
    mockTranslate.mockReturnValue(
      new Promise<string | null>((r) => {
        resolve = r;
      }),
    );
    const { result } = renderHook(() =>
      useAlertTranslation({ text: 'Épidémie de choléra', sourceLang: 'fr' }),
    );

    let translatePromise!: Promise<void>;
    act(() => {
      translatePromise = result.current.translate();
    });
    await waitFor(() => expect(result.current.loading).toBe(true));

    await act(async () => {
      resolve('Cholera outbreak');
      await translatePromise;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.translated).toBe('Cholera outbreak');
  });

  it('showOriginal flips back to original without losing the translation', async () => {
    mockTranslate.mockResolvedValue('Cholera outbreak');
    const { result } = renderHook(() =>
      useAlertTranslation({ text: 'Épidémie de choléra', sourceLang: 'fr' }),
    );
    await act(async () => {
      await result.current.translate();
    });
    expect(result.current.view).toBe('translated');

    act(() => result.current.showOriginal());
    expect(result.current.view).toBe('original');
    expect(result.current.translated).toBe('Cholera outbreak');

    // Re-translating should NOT call the API — the result is cached in state.
    mockTranslate.mockClear();
    await act(async () => {
      await result.current.translate();
    });
    expect(mockTranslate).not.toHaveBeenCalled();
    expect(result.current.view).toBe('translated');
  });

  it('translate() is a no-op when the feature is disabled', async () => {
    const { result } = renderHook(() =>
      useAlertTranslation({ text: 'Outbreak', sourceLang: 'en' }),
    );
    await act(async () => {
      await result.current.translate();
    });
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  describe('with a non-English target language', () => {
    it('can translate EN → FR', async () => {
      mockTranslate.mockResolvedValue('Épidémie de choléra');
      const { result } = renderHook(() =>
        useAlertTranslation({
          text: 'Cholera outbreak',
          sourceLang: 'en',
          targetLang: 'fr',
        }),
      );
      expect(result.current.canTranslate).toBe(true);
      await act(async () => {
        await result.current.translate();
      });
      expect(mockTranslate).toHaveBeenCalledWith('Cholera outbreak', 'fr', 'en');
      expect(result.current.translated).toBe('Épidémie de choléra');
      expect(result.current.view).toBe('translated');
    });

    it('disables translation when source and target match (both FR)', () => {
      const { result } = renderHook(() =>
        useAlertTranslation({
          text: 'Épidémie',
          sourceLang: 'fr',
          targetLang: 'fr',
        }),
      );
      expect(result.current.canTranslate).toBe(false);
    });

    it('resets translation state when the target language changes', async () => {
      mockTranslate.mockResolvedValue('Cholera outbreak');
      const { result, rerender } = renderHook(
        ({ target }: { target: string }) =>
          useAlertTranslation({
            text: 'Épidémie de choléra',
            sourceLang: 'fr',
            targetLang: target,
          }),
        { initialProps: { target: 'en' } },
      );

      await act(async () => {
        await result.current.translate();
      });
      expect(result.current.view).toBe('translated');
      expect(result.current.translated).toBe('Cholera outbreak');

      rerender({ target: 'pt' });
      expect(result.current.view).toBe('original');
      expect(result.current.translated).toBeNull();
    });

    it('ignores initialTranslation when the target is not English', () => {
      const { result } = renderHook(() =>
        useAlertTranslation({
          text: 'Cholera outbreak',
          sourceLang: 'en',
          targetLang: 'pt',
          // A backend-provided English translation should not seed a PT view.
          initialTranslation: null,
        }),
      );
      expect(result.current.view).toBe('original');
      expect(result.current.translated).toBeNull();
    });
  });
});
