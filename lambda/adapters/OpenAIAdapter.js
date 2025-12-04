// lambda/adapters/OpenAIAdapter.js
// OpenAI 公式 npm を使うアダプター実装
// 環境変数 OPENAI_API_KEY を優先使用。設定されていない場合は、
// AWS Secrets Manager から指定のシークレット名（OPENAI_SECRET_NAME）で取得するオプションを提供します。

// Try to load .env from lambda root so OPENAI_* env vars are available during local testing
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
    // dotenv not installed or .env missing - ignore
  }
} catch (e) {
  // ignore
}

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const AWS = require('aws-sdk');
const jiti = require('jiti')(__filename);

let ChatOpenAI = null;
const openAIModuleCache = {};
let chatCtorPromise = null;

function tryRequire(modulePath) {
  try {
    if (!openAIModuleCache[modulePath]) {
      openAIModuleCache[modulePath] = require(modulePath);
    }
    return openAIModuleCache[modulePath];
  } catch (err) {
    if (process.env.DEBUG_AI) {
      console.log(`[OpenAIAdapter] require(${modulePath}) 失敗:`, err && err.message ? err.message : err);
    }
    try {
      if (!openAIModuleCache[modulePath]) {
        openAIModuleCache[modulePath] = jiti(modulePath);
      }
      if (process.env.DEBUG_AI) {
        console.log(`[OpenAIAdapter] jiti(${modulePath}) 成功`);
      }
      return openAIModuleCache[modulePath];
    } catch (err2) {
      if (process.env.DEBUG_AI) {
        console.log(`[OpenAIAdapter] jiti(${modulePath}) 失敗:`, err2 && err2.message ? err2.message : err2);
      }
      return null;
    }
  }
}

async function loadChatOpenAI() {
  if (ChatOpenAI) return ChatOpenAI;
  if (chatCtorPromise) return chatCtorPromise;
  const candidateFns = [
    async () => tryRequire('@langchain/openai')?.ChatOpenAI,
    async () => tryRequire('@langchain/openai/dist/index.cjs')?.ChatOpenAI,
    async () => {
      const cjsPath = path.join(__dirname, '..', 'node_modules', '@langchain', 'openai', 'dist', 'index.cjs');
      return fs.existsSync(cjsPath) ? tryRequire(cjsPath)?.ChatOpenAI : null;
    }
  ];
  chatCtorPromise = (async () => {
    for (const factory of candidateFns) {
      const candidate = await factory();
      if (candidate) {
        ChatOpenAI = candidate;
        break;
      }
    }
    return ChatOpenAI;
  })();

  return chatCtorPromise;
}

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
  // Priority:
  // 1) explicit initialKey (constructor arg)
  // 2) OPENAI_API_KEY environment variable
  // 3) SSM Parameter Store (OPENAI_SSM_PARAM_NAME / OPENAI_SSM_NAME / OPENAI_SSM_PARAMETER)
  // 4) Secrets Manager (OPENAI_SECRET_NAME)
  if (initialKey) return initialKey;

  // 2) env var
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

  // 4) Secrets Manager (existing behaviour)
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

function normalizeContent(message) {
  if (!message) return '';
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.map(normalizeContent).join('\n');
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content.map(part => {
      if (!part) return '';
      if (typeof part === 'string') return part;
      if (typeof part.text === 'string') return part.text;
      if (typeof part.value === 'string') return part.value;
      if (part.content) return normalizeContent(part.content);
      return '';
    }).join('');
  }
  if (message.text) return message.text;
  if (message.response) return message.response;
  if (message.generations && Array.isArray(message.generations)) {
    const first = message.generations[0];
    if (Array.isArray(first) && first[0]) {
      return normalizeContent(first[0]);
    }
  }
  try {
    return JSON.stringify(message);
  } catch (err) {
    return String(message);
  }
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
  const parsed = extractJsonWithIntent(rawText);
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

class OpenAIAdapter {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || null;
    this.modelName = process.env.OPENAI_MODEL || DEFAULT_MODEL;
    this.timeoutMs = DEFAULT_TIMEOUT_MS;
    this.maxTokens = DEFAULT_MAX_TOKENS;
    this.chat = null;
    this.omitModalities = false;
  }

  async initIfNeeded() {
    if (this.chat) return;
    this.apiKey = await resolveApiKey(this.apiKey);
    if (!this.apiKey) {
      throw new Error('OpenAI API キーが見つかりません。OPENAI_API_KEY か OPENAI_SECRET_NAME を設定してください。');
    }
    const ChatCtor = await loadChatOpenAI();
    if (!ChatCtor) {
      throw new Error('@langchain/openai もしくは langchain/chat_models/openai の読み込みに失敗しました。lambda ディレクトリで npm install を実行し、テスト時は node_modules が解決可能か確認してください。');
    }
    const options = {
      modelName: this.modelName,
      openAIApiKey: this.apiKey,
      maxTokens: this.maxTokens,
      timeout: this.timeoutMs
    };
    if (!shouldSkipTemperature(this.modelName)) {
      options.temperature = 0;
    }
    const allowModalities = supportsModalities(this.modelName, this.omitModalities);
    if (allowModalities) {
      options.modelKwargs = Object.assign({}, options.modelKwargs, { modalities: ['text'] });
    }
    if (supportsJsonResponse(this.modelName)) {
      options.modelKwargs = Object.assign({}, options.modelKwargs, { response_format: { type: 'json_object' } });
    }
    this.chat = new ChatCtor(options);
  }

  async invokeWithTimeout(prompt) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      if (typeof this.chat.invoke === 'function') {
        return await this.chat.invoke(prompt, { signal: controller.signal });
      }
      if (typeof this.chat.call === 'function') {
        return await this.chat.call(prompt, { signal: controller.signal });
      }
      if (typeof this.chat.generate === 'function') {
        const res = await this.chat.generate([prompt], { signal: controller.signal });
        return res && res.generations && res.generations[0] && res.generations[0][0];
      }
      throw new Error('ChatOpenAI インスタンスが無効な形です。');
    } finally {
      clearTimeout(timer);
    }
  }

  async call(prompt) {
    await this.initIfNeeded();
    try {
      if (process.env.DEBUG_AI) {
        console.log('[OpenAIAdapter] call: model=', this.modelName);
        console.log('[OpenAIAdapter] call: prompt preview=', prompt.slice(0, 400));
      }
      const aiMessage = await this.invokeWithTimeout(prompt);
      if (process.env.DEBUG_AI) {
          console.log('[OpenAIAdapter] call: raw aiMessage=', aiMessage);
      }
      const content = normalizeContent(aiMessage);
      if (process.env.DEBUG_AI) {
        console.log('[OpenAIAdapter] call: raw content snippet=', (content || '').slice(0, 400));
      }
      return normalizeResult(content);
    } catch (err) {
      if (err && err.name === 'AbortError') {
        console.log('[OpenAIAdapter] タイムアウトで中断しました');
        return normalizeResult('', 'timeout');
      }
      if (isModalitiesError(err) && !this.omitModalities) {
        if (process.env.DEBUG_AI) {
          console.log('[OpenAIAdapter] modalities エラーを検出。パラメータを削除して再試行します。');
        }
        this.omitModalities = true;
        this.chat = null;
        return this.call(prompt);
      }
      console.log('[OpenAIAdapter] LangChain 呼び出し中の例外:', err && err.message ? err.message : err);
      if (process.env.DEBUG_AI) {
        console.log('[OpenAIAdapter] LangChain 呼び出し中の例外詳細:', err);
      }
      return normalizeResult('', err && err.message ? err.message : 'unknown-error');
    }
  }
}

module.exports = OpenAIAdapter;
