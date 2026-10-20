/**
 * linkRetrievalService.js — ChatGPT Shared-Link Retrieval
 * ─────────────────────────────────────────────────────────────────────────────
 * IMPORTANT — HONEST LIMITATION, READ BEFORE RELYING ON THIS:
 *
 * There is no official public API for reading a ChatGPT shared conversation.
 * The share page (chatgpt.com/share/...) is a client-rendered application —
 * the conversation text is loaded by JavaScript in the browser, not present
 * in the raw HTML most of the time. That means this service WILL fail for
 * many real share links, through no fault of the URL or the user.
 *
 * Architecture rule #3 anticipates exactly this: "Do NOT assume that every
 * ChatGPT link can automatically be accessed... If direct retrieval is
 * technically impossible or restricted, provide an appropriate fallback
 * such as asking the user to paste the conversation text." That fallback —
 * a clear, typed failure reason instead of a fake success — is the actual
 * deliverable here, not a guarantee that every link will work.
 *
 * This function makes a genuine, best-effort attempt (including trying to
 * find embedded page data), then fails honestly and specifically when it
 * can't read the content, rather than returning empty or fabricated text.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VALID_HOSTS = ['chat.openai.com', 'chatgpt.com'];
const FETCH_TIMEOUT_MS = 15_000;
const MIN_USABLE_LENGTH = 20;

function validateChatGPTUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { valid: false, reason: 'invalid_url', message: 'That is not a valid URL.' };
  }

  const isValidHost = VALID_HOSTS.some(h => url.hostname === h || url.hostname.endsWith(`.${h}`));
  if (!isValidHost) {
    return { valid: false, reason: 'unsupported_domain', message: 'Only chatgpt.com or chat.openai.com share links are supported.' };
  }

  return { valid: true, url };
}

/**
 * fetchSharedConversation
 * @param {string} rawUrl
 * @returns {Promise<{success:true, content:string} | {success:false, reason:string, message:string}>}
 */
async function fetchSharedConversation(rawUrl) {
  const validated = validateChatGPTUrl(rawUrl);
  if (!validated.valid) {
    return { success: false, reason: validated.reason, message: validated.message };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(validated.url.toString(), {
      signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; ExamPracticeChallenges/1.0)' },
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, reason: 'timeout', message: 'The request to that link took too long and timed out.' };
    }
    return { success: false, reason: 'network_error', message: 'Could not reach that link — check your connection or the URL.' };
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 404) {
    return { success: false, reason: 'not_found', message: 'That conversation link does not exist or is no longer available.' };
  }
  if (response.status === 401 || response.status === 403) {
    return { success: false, reason: 'forbidden', message: 'That conversation is private or access-restricted.' };
  }
  if (!response.ok) {
    return { success: false, reason: 'network_error', message: `The link responded with an unexpected status (${response.status}).` };
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return { success: false, reason: 'unsupported_content', message: 'That link did not return a readable conversation page.' };
  }

  const html = await response.text();
  const extracted = tryExtractConversationText(html);

  if (!extracted || extracted.trim().length < MIN_USABLE_LENGTH) {
    return {
      success: false,
      reason: 'unparseable',
      message: "We couldn't read the conversation content from that link. This can happen because ChatGPT share pages load their content dynamically in the browser.",
    };
  }

  return { success: true, content: extracted };
}

/**
 * tryExtractConversationText
 * Two best-effort strategies, in order of reliability. Returns null — never
 * a guess — if neither produces something trustworthy.
 */
function tryExtractConversationText(html) {
  // Strategy 1: look for a Next.js-style embedded data script tag, which
  // some server-rendered pages use to hydrate client state. If present,
  // conversation text is often buried somewhere inside it.
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const json = JSON.parse(nextDataMatch[1]);
      const found = deepFindLikelyConversationText(json);
      if (found) return found;
    } catch {
      // fall through to strategy 2
    }
  }

  // Strategy 2: strip all tags and use whatever visible text remains. Only
  // trust this if it's substantial AND looks MCQ-shaped — otherwise it's
  // almost certainly just nav/footer/marketing text, not the conversation.
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const looksLikeMCQContent = stripped.length > 200 && /\bA[).]\s|\bAnswer\b/i.test(stripped);
  return looksLikeMCQContent ? stripped : null;
}

function deepFindLikelyConversationText(obj, depth = 0) {
  if (depth > 6 || !obj || typeof obj !== 'object') return null;

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === 'string' && value.length > 200) return value;
    if (typeof value === 'object') {
      const found = deepFindLikelyConversationText(value, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

module.exports = { validateChatGPTUrl, fetchSharedConversation };
