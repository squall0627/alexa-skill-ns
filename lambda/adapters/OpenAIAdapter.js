// OpenAI アダプタ
// OpenAI 公式クライアントを使って AI 呼び出しを行うアダプタ実装（コメントは日本語）

// ローカルテスト時に lambda ルートの .env を読み込んで OPENAI_* 環境変数を利用可能にする試み
try {
  const path = require('path');
  const dotenvPath = path.join(__dirname, '..', '.env');
  try {
    const res = require('dotenv').config({ path: dotenvPath });
    if (process.env.DEBUG_AI) {
      console.log('[OpenAIAdapter] dotenv config result:', !!res.parsed);
      console.log('[OpenAIAdapter] env preview:', { OPENAI_MODEL: process.env.OPENAI_MODEL || null, OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '***' : null });
    }
  } catch (e) {
    // dotenv がインストールされていないか .env が存在しない場合は無視
  }
} catch (e) {
  // ignore
}

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const AWS = require('aws-sdk');
const OpenAI = require('openai');

(function hydrateEnv() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
    }
  } catch (err) {
    console.log('[OpenAIAdapter] .env 読み込み時の警告:', err && err.message ? err.message : err);
  }
})();

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 10000);
const DEFAULT_MAX_TOKENS = Number(process.env.OPENAI_MAX_TOKENS || 300);
const DEFAULT_REASONING_BUFFER = Number(process.env.OPENAI_REASONING_BUFFER || 512);
const DEFAULT_INCOMPLETE_RETRIES = Number(process.env.OPENAI_INCOMPLETE_RETRIES || 1);
const GPT5_MODALITY_BLOCKLIST = ['gpt-5-nano', 'gpt-5-mini'];
const JSON_RESPONSE_HINTS = ['gpt-4o', 'gpt-4.1', 'gpt-4.8', 'gpt-5'];

function supportsModalities(modelName, omitOverride = false) {
  if (omitOverride) return false;
  if (!modelName) return false;
  const lower = modelName.toLowerCase();
  if (GPT5_MODALITY_BLOCKLIST.some(h => lower.includes(h))) return false;
  return /gpt-4o|gpt-4\.1|gpt-4\.8|gpt-5/.test(lower);
}

function supportsJsonResponse(modelName) {
  if (!modelName) return false;
  const lower = modelName.toLowerCase();
  return JSON_RESPONSE_HINTS.some(h => lower.includes(h));
}

function isModalitiesError(err) {
  if (!err) return false;
  if (err.param === 'modalities' || err?.error?.param === 'modalities') return true;
  const msg = (err.message || err?.error?.message || '').toLowerCase();
  return msg.includes('modalities');
}

async function resolveApiKey(initialKey) {
  // 優先順位:
  // 1) コンストラクタ引数として明示的に渡された初期キー
  // 2) 環境変数 OPENAI_API_KEY
  // 3) SSM Parameter Store (OPENAI_SSM_PARAM_NAME / OPENAI_SSM_NAME / OPENAI_SSM_PARAMETER)
  // 4) Secrets Manager (OPENAI_SECRET_NAME)
  if (initialKey) return initialKey;

  // 2) 環境変数
  if (process.env.OPENAI_API_KEY) {
    if (process.env.DEBUG_AI) {
      console.log('[OpenAIAdapter] resolveApiKey: using OPENAI_API_KEY from env (masked)');
    }
    return process.env.OPENAI_API_KEY;
  }

  // 3) SSM Parameter Store
  const ssmParamName = process.env.OPENAI_SSM_PARAM_NAME || process.env.OPENAI_SSM_NAME || process.env.OPENAI_SSM_PARAMETER;
  if (ssmParamName) {
    try {
      if (process.env.DEBUG_AI) console.log('[OpenAIAdapter] resolveApiKey: attempting SSM Parameter Store lookup for', ssmParamName);
      const ssm = new AWS.SSM();
      const getParameter = promisify(ssm.getParameter.bind(ssm));
      const data = await getParameter({ Name: ssmParamName, WithDecryption: true });
      const value = data && data.Parameter && data.Parameter.Value ? data.Parameter.Value : null;
      if (value && String(value).trim().length > 0) {
        if (process.env.DEBUG_AI) console.log('[OpenAIAdapter] resolveApiKey: retrieved value from SSM (masked)');
        // Accept either a raw API key string or a JSON blob that contains known keys.
        try {
          const parsed = JSON.parse(value);
          if (parsed && typeof parsed === 'object') {
            return parsed.OPENAI_API_KEY || parsed.openai_api_key || parsed.apiKey || parsed.api_key || null;
          }
          // If parsing produced a primitive, fall back to string
        } catch (e) {
          // not JSON, treat as raw string
        }
        return String(value).trim();
      } else {
        if (process.env.DEBUG_AI) console.log('[OpenAIAdapter] resolveApiKey: SSM parameter found but empty');
      }
    } catch (err) {
      // Log minimal info in normal runs, more details when DEBUG_AI is enabled.
      if (process.env.DEBUG_AI) {
        console.log('[OpenAIAdapter] SSM Parameter Store 取得エラー:', err && err.message ? err.message : err);
      } else {
        console.log('[OpenAIAdapter] SSM Parameter Store lookup failed for', ssmParamName);
      }
      // fall through to Secrets Manager fallback
    }
  }

  // 4) Secrets Manager (既存の挙動)
  const secretName = process.env.OPENAI_SECRET_NAME;
  if (!secretName) return null;
  try {
    const sm = new AWS.SecretsManager();
    const getSecretValue = promisify(sm.getSecretValue.bind(sm));
    const data = await getSecretValue({ SecretId: secretName });
    if (!data || !data.SecretString) return null;
    try {
      const parsed = JSON.parse(data.SecretString);
      return parsed.OPENAI_API_KEY || parsed.openai_api_key || parsed.apiKey || parsed.api_key || null;
    } catch (err) {
      return data.SecretString.trim();
    }
  } catch (err) {
    console.log('[OpenAIAdapter] Secrets Manager 取得エラー:', err && err.message ? err.message : err);
    return null;
  }
}

function shouldSkipTemperature(modelName) {
  if (!modelName) return false;
  return /gpt-5/i.test(modelName);
}

function collectResponseOutput(payload) {
  if (!payload) return null;
  if (typeof payload.output_text === 'string' && payload.output_text.trim().length > 0) {
    return payload.output_text;
  }
  const segments = [];
  if (Array.isArray(payload.output)) {
    for (const item of payload.output) {
      if (!item) continue;
      if (Array.isArray(item.content)) {
        for (const part of item.content) {
          if (!part) continue;
          if (part.type === 'output_text' && part.text) {
            segments.push(typeof part.text === 'string' ? part.text : part.text.value || '');
          } else if (part.type === 'text' && part.text) {
            segments.push(typeof part.text === 'string' ? part.text : part.text.value || '');
          }
        }
      } else if (item.type === 'output_text' && item.text) {
        segments.push(typeof item.text === 'string' ? item.text : item.text.value || '');
      }
    }
  }
  if (!segments.length && Array.isArray(payload.choices)) {
    const choice = payload.choices[0];
    if (choice && choice.message && choice.message.content) {
      return flattenMessageContent(choice.message.content);
    }
  }
  const combined = segments.join('\n').trim();
  return combined.length ? combined : null;
}

function flattenMessageContent(message) {
  if (!message) return '';
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.map(flattenMessageContent).join('\n');
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content.map(part => {
      if (!part) return '';
      if (typeof part === 'string') return part;
      if (typeof part.text === 'string') return part.text;
      if (typeof part.value === 'string') return part.value;
      if (part.content) return flattenMessageContent(part.content);
      return '';
    }).join('');
  }
  if (message.text) return message.text;
  if (message.response) return message.response;
  if (message.generations && Array.isArray(message.generations)) {
    const first = message.generations[0];
    if (Array.isArray(first) && first[0]) {
      return flattenMessageContent(first[0]);
    }
  }
  try {
    return JSON.stringify(message);
  } catch (err) {
    return String(message);
  }
}

function normalizeContent(message) {
  const responseText = collectResponseOutput(message);
  if (responseText) return responseText;
  return flattenMessageContent(message);
}

function extractJsonWithIntent(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  const trimmed = rawText.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'intent')) {
      return parsed;
    }
  } catch (err) {
    // JSON 以外の文字列だった場合は後続の探索に任せる
  }
  const slices = trimmed.match(/\{[\s\S]*?}/g) || [];
  for (const slice of slices) {
    try {
      const candidate = JSON.parse(slice);
      if (candidate && typeof candidate === 'object' && Object.prototype.hasOwnProperty.call(candidate, 'intent')) {
        return candidate;
      }
    } catch (err) {
      // 解析失敗は無視
    }
  }
  return null;
}

function normalizeResult(rawText, rawError) {
  const base = { intent: null, sample: null, confidence: 0, slots: null };
  const dbg = process.env.DEBUG_AI;
  if (!rawText) {
    if (dbg) console.log('[OpenAIAdapter] normalizeResult: empty rawText, rawError=', rawError);
    if (rawError) return { ...base, raw: rawError };
    return base;
  }
  if (dbg) console.log('[OpenAIAdapter] normalizeResult: rawText snippet=', rawText.slice(0, 200));
  let parsed = extractJsonWithIntent(rawText);
  if (!parsed) {
    parsed = tryAppendClosingBrace(rawText);
  }
  if (!parsed) {
    if (dbg) console.log('[OpenAIAdapter] normalizeResult: JSON parse failed');
    return { ...base, sample: rawText.slice(0, 500), raw: rawText };
  }
  const normalized = {
    intent: parsed.intent || null,
    sample: parsed.sample || null,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : Number(parsed.confidence || 0),
    slots: parsed.slots && typeof parsed.slots === 'object' ? parsed.slots : null
  };
  if (dbg) console.log('[OpenAIAdapter] normalizeResult: parsed=', normalized);
  return normalized;
}

function tryAppendClosingBrace(rawText) {
  if (typeof rawText !== 'string') return null;
  const trimmed = rawText.trim();
  if (!trimmed.startsWith('{') || trimmed.endsWith('}')) return null;
  try {
    return JSON.parse(trimmed + '}');
  } catch (err) {
    return null;
  }
}

function isIncompleteMaxTokens(response) {
  if (!response || typeof response !== 'object') return false;
  const reason = response?.incomplete_details?.reason;
  return response.status === 'incomplete' && reason === 'max_output_tokens';
}

class OpenAIAdapter {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || null;
    this.modelName = process.env.OPENAI_MODEL || DEFAULT_MODEL;
    this.timeoutMs = DEFAULT_TIMEOUT_MS;
    this.maxTokens = DEFAULT_MAX_TOKENS;
    this.reasoningTokenBuffer = DEFAULT_REASONING_BUFFER;
    this.client = null;
    this.omitModalities = false;
    this.lastPartialOutput = null;
  }

  async initIfNeeded() {
    if (this.client) return;
    this.apiKey = await resolveApiKey(this.apiKey);
    if (!this.apiKey) {
      throw new Error('OpenAI API キーが見つかりません。OPENAI_API_KEY か OPENAI_SECRET_NAME を設定してください。');
    }
    this.client = new OpenAI({ apiKey: this.apiKey });
  }

  buildRequestBody(prompt) {
    const outputLimit = Math.max(1, this.maxTokens + Math.max(0, this.reasoningTokenBuffer));
    const body = {
      model: this.modelName,
      input: prompt,
      max_output_tokens: outputLimit
    };
    if (!shouldSkipTemperature(this.modelName)) {
      body.temperature = 0;
    }
    if (supportsModalities(this.modelName, this.omitModalities)) {
      body.modalities = ['text'];
    }
    if (supportsJsonResponse(this.modelName)) {
      body.text = Object.assign({}, body.text, { format: { type: 'json_object' } });
    }
    return body;
  }

  async invokeWithTimeout(prompt) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const body = this.buildRequestBody(prompt);
      const res = await this.client.responses.create(body, { signal: controller.signal });
      if (res && res.output_text) {
        this.lastPartialOutput = res.output_text;
      }
      if (res && res.output && res.status === 'incomplete' && res.incomplete_details && res.incomplete_details.reason === 'max_output_tokens') {
        if (process.env.DEBUG_AI) {
          console.log('[OpenAIAdapter] Responses API returned incomplete output due to token limit. Using partial output_text if available.');
        }
        if (this.lastPartialOutput) {
          return this.lastPartialOutput;
        }
      }
      return res;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`OpenAI リクエストがタイムアウトしました。(${this.timeoutMs}ms)`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  buildContentFromRaw(raw) {
    if (typeof raw === 'string') {
      return raw;
    }
    return normalizeContent(raw);
  }

  normalizeResponse(raw) {
    const content = this.buildContentFromRaw(raw) || '';
    if (process.env.DEBUG_AI) {
      console.log('[OpenAIAdapter] call: raw content snippet=', content.slice(0, 400));
    }
    return normalizeResult(content);
  }

  async call(prompt) {
    await this.initIfNeeded();
    const retries = Math.max(0, DEFAULT_INCOMPLETE_RETRIES);
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (process.env.DEBUG_AI) {
          console.log(`[OpenAIAdapter] call attempt ${attempt + 1}/${retries + 1}: model=`, this.modelName);
          console.log('[OpenAIAdapter] call: prompt preview=', prompt.slice(0, 400));
        }
        const rawResponse = await this.invokeWithTimeout(prompt);
        if (!rawResponse) {
          continue;
        }
        if (typeof rawResponse !== 'string' && isIncompleteMaxTokens(rawResponse)) {
          if (process.env.DEBUG_AI) {
            console.log('[OpenAIAdapter] 不完全な応答を検出しました (max_output_tokens)。再試行します...');
          }
          continue;
        }
        if (process.env.DEBUG_AI) {
          console.log('[OpenAIAdapter] call: raw aiMessage=', rawResponse);
        }
        return this.normalizeResponse(rawResponse);
      } catch (err) {
        lastError = err;
        if (err && err.name === 'AbortError') {
          console.log('[OpenAIAdapter] タイムアウトで中断しました');
          return normalizeResult('', 'timeout');
        }
        if (isModalitiesError(err) && !this.omitModalities) {
          if (process.env.DEBUG_AI) {
            console.log('[OpenAIAdapter] modalities エラーを検出。パラメータを削除して再試行します。');
          }
          this.omitModalities = true;
          continue;
        }
        console.log('[OpenAIAdapter] OpenAI API 呼び出し中の例外:', err && err.message ? err.message : err);
        if (process.env.DEBUG_AI) {
          console.log('[OpenAIAdapter] OpenAI API 呼び出し中の例外詳細:', err);
        }
      }
    }
    const fallbackError = lastError && lastError.message ? lastError.message : 'unknown-error';
    return normalizeResult('', fallbackError);
  }

  get lastOutput() {
    return this.lastPartialOutput;
  }
}

module.exports = OpenAIAdapter;
