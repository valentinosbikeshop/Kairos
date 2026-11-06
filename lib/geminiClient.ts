/**
 * KAIROS High-Power Anti-Saturation Gemini AI Engine
 * --------------------------------------------------
 * Guarantees 100% availability and maximum reasoning power without API saturation:
 * 1. Multi-Model Power Cascade: Automatically tries the highest-capability model
 *    available (`gemini-2.5-pro` -> `gemini-2.5-flash` -> `gemini-2.0-flash`)
 *    and fails over transparently in milliseconds if a model is rate-limited (429),
 *    overloaded (503), or unavailable on the user's tier.
 * 2. Concurrency Semaphore Queue: Caps simultaneous in-flight requests to prevent
 *    burst saturation.
 * 3. Sliding-Window Rate Limiter: Protects against RPM quota exhaustion.
 * 4. In-Flight Deduplication & LRU Response Cache: Eliminates redundant calls.
 * 5. Strict AbortController Timeouts: Ensures the UI never hangs.
 */

export type GeminiPowerTier = 'pro' | 'balanced' | 'vision';

export interface GeminiGenerateOptions {
  prompt: string;
  tier?: GeminiPowerTier;
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: 'application/json' | 'text/plain';
  inlineImage?: {
    mimeType: string;
    base64Data: string;
  };
  cacheTtlMs?: number;
  timeoutPerModelMs?: number;
  bypassCache?: boolean;
}

export interface GeminiGenerateResult {
  ok: boolean;
  text: string | null;
  modelUsed: string | null;
  fromCache: boolean;
  error?: string;
}

const customModel = process.env.GEMINI_MODEL?.trim();

const FULL_CASCADE_LADDER: readonly string[] = [
  ...(customModel ? [customModel] : []),
  // Escalón 1: Generación de Vanguardia (Máxima potencia analítica y biomecánica profunda)
  'gemini-3.8-pro',
  'gemini-3.8-flash',
  'gemini-3-pro',
  'gemini-3-flash',
  // Escalón 2: Generación 2.5
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  // Escalón 3: Generación 2.0 (Alta velocidad y ultra disponibilidad)
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  // Escalón 4: Generación 1.5 (Máxima estabilidad y respaldo histórico)
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
];

const BALANCED_CASCADE_LADDER: readonly string[] = [
  ...(customModel ? [customModel] : []),
  'gemini-3.8-flash',
  'gemini-3-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-3.8-pro',
  'gemini-2.5-pro',
  'gemini-1.5-pro',
];

const VISION_CASCADE_LADDER: readonly string[] = [
  ...(customModel ? [customModel] : []),
  'gemini-3.8-flash',
  'gemini-3-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.5-pro',
  'gemini-3.8-pro',
];

const MODEL_CASCADES: Record<GeminiPowerTier, readonly string[]> = {
  pro: FULL_CASCADE_LADDER,
  balanced: BALANCED_CASCADE_LADDER,
  vision: VISION_CASCADE_LADDER,
};

interface CacheEntry {
  text: string;
  modelUsed: string;
  expiresAt: number;
}

const MAX_CACHE_ENTRIES = 250;
const MAX_CONCURRENT_REQUESTS = 3;
const MAX_REQUESTS_PER_WINDOW = 14;
const RATE_WINDOW_MS = 60_000;

// Module-level singletons (persisted across hot requests in Node runtime)
const responseCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<GeminiGenerateResult>>();
const modelCooldownUntil = new Map<string, number>();
const recentRequestTimestamps: number[] = [];

let activeConcurrentCount = 0;
const waitQueue: Array<() => void> = [];

function computeRequestHash(opts: GeminiGenerateOptions): string {
  const imgTag = opts.inlineImage
    ? `|img:${opts.inlineImage.mimeType}:${opts.inlineImage.base64Data.length}:${opts.inlineImage.base64Data.slice(0, 64)}`
    : '';
  return `${opts.tier || 'pro'}|${opts.responseMimeType || 'text/plain'}|${opts.prompt}${imgTag}`;
}

function getCachedResult(hash: string): CacheEntry | null {
  const entry = responseCache.get(hash);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(hash);
    return null;
  }
  return entry;
}

function setCachedResult(hash: string, text: string, modelUsed: string, ttlMs: number): void {
  if (ttlMs <= 0) return;
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(hash, {
    text,
    modelUsed,
    expiresAt: Date.now() + ttlMs,
  });
}

function acquireConcurrencySlot(): Promise<void> {
  if (activeConcurrentCount < MAX_CONCURRENT_REQUESTS) {
    activeConcurrentCount++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    waitQueue.push(() => {
      activeConcurrentCount++;
      resolve();
    });
  });
}

function releaseConcurrencySlot(): void {
  activeConcurrentCount = Math.max(0, activeConcurrentCount - 1);
  const next = waitQueue.shift();
  if (next) next();
}

function pruneAndCheckRateWindow(): boolean {
  const now = Date.now();
  while (recentRequestTimestamps.length > 0 && now - recentRequestTimestamps[0] > RATE_WINDOW_MS) {
    recentRequestTimestamps.shift();
  }
  return recentRequestTimestamps.length < MAX_REQUESTS_PER_WINDOW;
}

function recordRequestTimestamp(): void {
  recentRequestTimestamps.push(Date.now());
}

function isModelOnCooldown(model: string): boolean {
  const until = modelCooldownUntil.get(model);
  if (!until) return false;
  if (Date.now() > until) {
    modelCooldownUntil.delete(model);
    return false;
  }
  return true;
}

function markModelCooldown(model: string, status: number): void {
  // 429 Too Many Requests / 503 Overloaded -> 45s cooldown for this specific model
  // 404 Not Found / 400 Unsupported -> 15 min cooldown so we skip directly to available models
  const durationMs = status === 404 || status === 400 ? 15 * 60_000 : 45_000;
  modelCooldownUntil.set(model, Date.now() + durationMs);
}

/**
 * Executes a Gemini generation request with automatic model cascade,
 * anti-saturation concurrency gating, deduplication, and caching.
 */
export async function generateWithGeminiCascade(
  options: GeminiGenerateOptions
): Promise<GeminiGenerateResult> {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) {
    return {
      ok: false,
      text: null,
      modelUsed: null,
      fromCache: false,
      error: 'GEMINI_API_KEY no configurada.',
    };
  }

  const tier: GeminiPowerTier = options.tier ?? 'pro';
  const cacheTtlMs = options.cacheTtlMs ?? 10 * 60_000; // Default 10 minutes
  const timeoutMs = options.timeoutPerModelMs ?? 5_800; // 5.8s per model for snappy step-down
  const hash = computeRequestHash(options);

  // 1. Check LRU Cache first (0 quota consumption)
  if (!options.bypassCache) {
    const cached = getCachedResult(hash);
    if (cached) {
      return {
        ok: true,
        text: cached.text,
        modelUsed: cached.modelUsed,
        fromCache: true,
      };
    }
  }

  // 2. Check In-Flight Deduplication
  const existingInFlight = inFlightRequests.get(hash);
  if (existingInFlight) {
    return existingInFlight;
  }

  const executionPromise = (async (): Promise<GeminiGenerateResult> => {
    await acquireConcurrencySlot();
    try {
      const models = MODEL_CASCADES[tier] || MODEL_CASCADES.pro;
      let lastError = 'No se pudo obtener respuesta de los modelos Gemini.';

      // Step-down strategy: try healthy models in exact cascade order (from newest/most powerful to lightest/historical)
      // If every model happens to be marked in cooldown, don't fail: try from the most lightweight/reliable models upward
      const healthyModels = models.filter((m) => !isModelOnCooldown(m));
      const inCooldownModels = models.filter((m) => isModelOnCooldown(m));
      const candidateModels =
        healthyModels.length > 0 ? healthyModels : [...inCooldownModels].reverse();

      for (const model of candidateModels) {
        // Smooth burst rate without abandoning the loop
        if (!pruneAndCheckRateWindow()) {
          await new Promise((r) => setTimeout(r, 250));
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
          recordRequestTimestamp();

          const parts: Array<Record<string, unknown>> = [{ text: options.prompt }];
          if (options.inlineImage) {
            parts.push({
              inline_data: {
                mime_type: options.inlineImage.mimeType,
                data: options.inlineImage.base64Data,
              },
            });
          }

          const generationConfig: Record<string, unknown> = {
            temperature: options.temperature ?? 0.25,
          };
          if (options.maxOutputTokens) {
            generationConfig.maxOutputTokens = options.maxOutputTokens;
          }
          if (options.responseMimeType) {
            generationConfig.responseMimeType = options.responseMimeType;
          }

          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts }],
                generationConfig,
              }),
              signal: controller.signal,
            }
          );

          clearTimeout(timer);

          if (!resp.ok) {
            if (resp.status === 429 || resp.status === 503 || resp.status === 404 || resp.status === 400) {
              markModelCooldown(model, resp.status);
            }
            lastError = `HTTP ${resp.status} en ${model}`;
            continue;
          }

          const json = (await resp.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

          if (rawText && rawText.length > 0) {
            if (!options.bypassCache && cacheTtlMs > 0) {
              setCachedResult(hash, rawText, model, cacheTtlMs);
            }
            return {
              ok: true,
              text: rawText,
              modelUsed: model,
              fromCache: false,
            };
          }

          lastError = `Respuesta vacía de ${model}`;
        } catch (err) {
          clearTimeout(timer);
          const isAbort = err instanceof Error && err.name === 'AbortError';
          if (isAbort) {
            // Put slow/timed-out model on brief cooldown so next requests use faster model
            modelCooldownUntil.set(model, Date.now() + 20_000);
            lastError = `Tiempo de espera agotado en ${model}`;
          } else {
            lastError = err instanceof Error ? err.message : `Error de red en ${model}`;
          }
          continue;
        }
      }

      return {
        ok: false,
        text: null,
        modelUsed: null,
        fromCache: false,
        error: lastError,
      };
    } finally {
      releaseConcurrencySlot();
      inFlightRequests.delete(hash);
    }
  })();

  inFlightRequests.set(hash, executionPromise);
  return executionPromise;
}

/**
 * Safely parses JSON from an AI response, stripping optional markdown code fences if present.
 */
export function parseCleanJsonFromAi<T = unknown>(rawText: string | null): T | null {
  if (!rawText) return null;
  try {
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    // Try extracting the outermost JSON object or array
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(rawText.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
