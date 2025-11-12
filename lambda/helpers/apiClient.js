// helpers/apiClient.js
// 日本語：バックエンド機能別 API を呼び出すための共通クライアント
// - LLM_BACKEND_URL（例: https://example.com/llm）からベースURLを推測し、/api 配下にPOSTします。
// - 環境変数 BACKEND_API_BASE が設定されていればそれを優先します。
// - セッション属性は往復で維持します。

// Load .env file in local development
try {
  require('dotenv').config();
} catch (_e) {
  // dotenv not available (OK in production Lambda)
}

const fetch = (...args) => import('node-fetch').then(module => module.default(...args));

const LLM_BACKEND_URL = process.env.LLM_BACKEND_URL || '';
const BACKEND_API_BASE = process.env.BACKEND_API_BASE || '';
const BACKEND_SECRET = process.env.BACKEND_SECRET;

// /llm を取り除き API ベースを導出（フォールバック）
function deriveApiBase() {
  if (BACKEND_API_BASE) return BACKEND_API_BASE.replace(/\/$/, '');
  if (!LLM_BACKEND_URL) return '';
  try {
    const url = new URL(LLM_BACKEND_URL);
    // 末尾 /llm を /api に置換、なければ /api を追加
    if (url.pathname.endsWith('/llm')) {
      url.pathname = url.pathname.replace(/\/llm$/, '/api');
    } else if (!url.pathname.endsWith('/api')) {
      url.pathname = (url.pathname.replace(/\/$/, '')) + '/api';
    }
    return url.toString().replace(/\/$/, '');
  } catch (_e) {
    return '';
  }
}

const API_BASE = deriveApiBase();

// エラーを標準化
function toUserError(message) {
  return {
    spokenResponse: message || '申し訳ありません。現在リクエストを処理できません。少し時間をおいてもう一度お試しください。',
    reprompt: '恐れ入りますが、もう一度お願いします。',
    shouldEndSession: false,
    sessionAttributes: undefined,
  };
}

// POST ヘルパー（JSON I/O）
async function postJson(path, payload) {
  console.log('API POST', path, payload);
  if (!API_BASE) throw new Error('API base URL is未設定');
  const url = `${API_BASE}${path}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-backend-secret': BACKEND_SECRET || '',
    },
    body: JSON.stringify(payload || {}),
  });
  if (!resp.ok) {
    console.error('API error', resp.status, await resp.text().catch(()=> ''));
    const text = await resp.text().catch(()=> '');
    const err = new Error(`API error ${resp.status}: ${text}`);
    err.status = resp.status;
    throw err;
  }
  console.log('API response result:', resp.status);
  return resp.json();
}

module.exports = {
  postJson,
  toUserError,
};
