// services/sessionStore.js
// 日本語：簡易インメモリ・セッションストア。本番では永続ストアを利用してください。

const sessions = new Map();

/**
 * セッションIDに紐づく状態を取得/初期化
 * @param {string} sessionId
 * @return {object}
 */
function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      cart: [], // {id,title,price,qty,category}
      lastList: [],
      page: 0,
      pageSize: 3,
      pendingAction: null, // { type: 'checkout' | 'cancelOrder', payload? }
      lastOrder: null, // { orderNo, status, total }
      pickupOrDelivery: null, // 'pickup' | 'delivery'
      coupons: [],
      selectedItem: null,
    });
  }
  return sessions.get(sessionId);
}

/**
 * Alexa 側から受け取った sessionAttributes をマージ（バックエンド側の値を優先）
 */
function mergeAttributes(state, attributes) {
  if (attributes && typeof attributes === 'object') {
    Object.assign(state, attributes);
  }
  return state;
}

module.exports = { getSession, mergeAttributes };
