// lambda/adapters/OllamaAdapter.js
// Ollama ローカルサーバーを呼び出すためのシンプルアダプター
// 簡潔な実装で、prompt を送信してモデルが返すテキスト（本プロンプトではJSON）を解析して
// { intent, sample, confidence } を返すことを目的とする。

// Try to load .env from lambda root early so DEFAULT_* constants pick up values.
try {
  const path = require('path');
  const dotenvPath = path.join(__dirname, '..', '.env');
  try {
    const res = require('dotenv').config({ path: dotenvPath });
    if (process.env.DEBUG_AI) {
      console.log('[OllamaAdapter] dotenv config result:', !!res.parsed);
      // Print which important vars were set (do not print full secret values)
      console.log('[OllamaAdapter] env preview:', {
        OLLAMA_HOST: process.env.OLLAMA_HOST ? '***' : null,
        OLLAMA_MODEL: process.env.OLLAMA_MODEL || null
      });
    }
  } catch (e) { /* dotenv not installed or .env missing */ }
} catch (e) { /* ignore */ }

const DEFAULT_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:20b';
const DEFAULT_TIMEOUT_MS = 100000;

function requireFetch() {
  try {
    const f = require('node-fetch');
    return f && f.default ? f.default : f;
  } catch (e) {
    // node 18+ has global fetch
    if (typeof fetch !== 'undefined') return fetch;
    throw new Error('fetch not available: please install node-fetch or use Node 18+');
  }
}

class OllamaAdapter {
  constructor(host, model, timeoutMs) {
    this.host = host || DEFAULT_HOST;
    this.model = model || DEFAULT_MODEL;
    this.timeoutMs = timeoutMs || DEFAULT_TIMEOUT_MS;
    this.fetch = requireFetch();
  }

  async call(prompt) {
      console.log('[OllamaAdapter] call with prompt:', prompt ? prompt : 0);
    const url = `${this.host}/api/generate`;
    const body = {
      model: this.model,
      prompt: prompt,
      stream: false,
      // hint: limit output length; adapters may ignore unknown keys if not supported
      max_output_tokens: 512
      // Ollama may support options; keep it minimal
      // We rely on the model to return JSON-only per the prompt
    };

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
        console.log('[OllamaAdapter] response status:', res.status);
      const text = await res.text();
      console.log('[OllamaAdapter] response text:', text);
      // Model may stream NDJSON lines (each line is a JSON object with fields like 'thinking' or 'response').
      // Try several strategies to recover a final JSON result:
      // 1) parse the whole text as JSON
      // 2) parse NDJSON lines, concatenate 'response' fields or 'thinking' tokens into a single string
      // 3) try to extract the first JSON object substring
      let js = null;
      // Strategy 1: whole-body JSON
      try { js = JSON.parse(text); } catch (e) { js = null; }

      // If top-level parsed object has a 'response' or 'thinking' field that contains JSON string, try to parse it
      if (js && typeof js === 'object') {
        // Try to extract JSON that contains 'intent' from js.response or js.thinking
        const candidate = extractJSONWithKey(js.response || js.thinking || '', 'intent');
        if (candidate) js = candidate;
      }

      // Strategy 2: NDJSON / streaming lines
      if (!js) {
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        const thinkingParts = [];
        const responseParts = [];
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            if (obj.response && typeof obj.response === 'string') responseParts.push(obj.response);
            if (obj.thinking && typeof obj.thinking === 'string') thinkingParts.push(obj.thinking);
            // If a line itself looks like the target JSON (has intent/sample), return it
            if (obj.intent || obj.sample || obj.confidence) {
              js = js || obj;
            }
          } catch (e) {
            // not a JSON line, ignore
          }
        }

        // build combined textual output from responseParts (prefer) or thinkingParts
        const combinedText = responseParts.length ? responseParts.join('') : thinkingParts.join('');
        if (!js && combinedText) {
          // Try to extract a JSON object that includes 'intent' from the combined text
          const c = extractJSONWithKey(combinedText, 'intent');
          if (c) js = c;
        }
      }

      // Strategy 3: fallback - try to find any JSON substring in the raw text
      if (!js) {
        const f = extractJSONWithKey(text, 'intent');
        if (f) js = f;
      }

      if (js && typeof js === 'object') {
        return { intent: js.intent || null, sample: js.sample || null, confidence: Number(js.confidence || 0), slots: js.slots || null };
      }

      // 最後は低信心のフォールバック（不確かな人間読みテキストは sample に入れない）
      return { intent: null, sample: null, confidence: 0 };
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('[OllamaAdapter] request aborted (timeout)');
        return { intent: null, sample: null, confidence: 0 };
      }
      console.log('[OllamaAdapter] request error:', err);
      return { intent: null, sample: null, confidence: 0 };
    } finally {
      clearTimeout(id);
    }
  }
}

// Helper: try to extract a JSON object substring that contains a desired key (e.g., 'intent')
function extractJSONWithKey(text, key) {
  if (!text || typeof text !== 'string') return null;
  // try direct parse first
  try {
    const j = JSON.parse(text);
    if (j && typeof j === 'object' && (key in j)) return j;
  } catch (e) {
    // ignore
  }
  // find all substrings that look like JSON objects and try to parse them
  const matches = [];
  const re = /\{[\s\S]*?\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    matches.push(m[0]);
  }
  for (const s of matches) {
    try {
      const parsed = JSON.parse(s);
      if (parsed && typeof parsed === 'object' && (key in parsed)) return parsed;
    } catch (e) {
      // ignore
    }
  }
  return null;
}

module.exports = OllamaAdapter;
