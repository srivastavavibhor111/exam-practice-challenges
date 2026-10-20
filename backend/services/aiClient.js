/**
 * aiClient.js — Thin Google Gemini API Wrapper — UPDATED
 * ─────────────────────────────────────────────────────────────────────────────
 * callAI() now accepts an `apiKey` parameter instead of always reading
 * process.env.GEMINI_API_KEY internally. Every caller is now expected to
 * resolve the RIGHT key first (a user's own stored key, or the server's
 * default as a fallback — see authService.getEffectiveGeminiApiKey) and
 * pass it in explicitly. If no key is passed, this still falls back to
 * the server's own env var as a last defensive layer — belt and
 * suspenders, not the expected normal path.
 *
 * Everything else (jsonMode, temperature defaults) is unchanged.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = process.env.AI_MODEL || 'gemini-2.5-flash';
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * callAI
 * @param {Object} params
 * @param {string} params.system
 * @param {string} params.prompt
 * @param {number} [params.maxTokens]
 * @param {boolean} [params.jsonMode=false]
 * @param {number}  [params.temperature]
 * @param {string}  [params.apiKey] — the Gemini API key to use for this
 *   call. Callers should resolve this via authService.getEffectiveGeminiApiKey(userId)
 *   before calling. Falls back to process.env.GEMINI_API_KEY if omitted.
 * @returns {Promise<string>}
 */
async function callAI({ system, prompt, maxTokens = 4096, jsonMode = false, temperature, apiKey }) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('No Gemini API key available. Set one in your profile, or configure GEMINI_API_KEY on the server.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `${GEMINI_API_BASE}/${DEFAULT_MODEL}:generateContent`;

    const generationConfig = {
      maxOutputTokens: maxTokens,
      temperature: temperature ?? (jsonMode ? 0 : 0.6),
    };
    if (jsonMode) {
      generationConfig.responseMimeType = 'application/json';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      // A 400/401/403 here very likely means the KEY ITSELF is invalid —
      // worth a clearer message than a raw API error dump, since this is
      // now a per-user key that could simply be wrong or revoked.
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        throw new Error('Your Gemini API key appears to be invalid or has been revoked. Please check it in your Profile settings.');
      }
      throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    if (!candidate) {
      throw new Error('Gemini API returned no candidates.');
    }
    if (candidate.finishReason === 'SAFETY') {
      throw new Error('Gemini declined to respond due to its safety filters.');
    }

    const text = candidate.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini API returned no text content.');
    }

    return text;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('The AI request timed out.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = { callAI };
