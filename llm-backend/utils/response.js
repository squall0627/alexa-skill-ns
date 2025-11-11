// utils/response.js
// 日本語スキル向けのレスポンス共通フォーマットを生成するユーティリティ

/**
 * Alexa スキル側の期待に合わせたレスポンスオブジェクトを生成する。
 * @param {Object} params
 * @param {string} params.speech - ユーザーに読み上げる本文（SSML でないプレーンテキスト）
 * @param {string} [params.reprompt='どうしますか？'] - 無音時の再プロンプト
 * @param {boolean} [params.shouldEndSession=false] - セッション終了フラグ
 * @param {Object} [params.sessionState] - セッション属性（状態）
 */
function respond({ speech, reprompt = 'どうしますか？', shouldEndSession = false, sessionState }) {
  return {
    spokenResponse: speech,
    reprompt,
    shouldEndSession,
    sessionAttributes: sessionState,
  };
}

module.exports = { respond };
