// 会話履歴サービス
// 会話履歴の簡易的な永続化サービス
// 目的: ユーザーとAlexaのやり取りを順次記録して、人工知能フォールバックで利用できる形で保持する
// すべてのユーザー可視メッセージ（発話）は日本語で保存する。コメントも日本語。

const MAX_ENTRIES = 20; // 保持する最大発話数
const MAX_TOTAL_CHARS = 8000; // JSON 文字列の長さの上限（概算）

/**
 * attributesManager: handlerInput.attributesManager
 * role: 'USER' | 'ALEXA'
 * text: 発話テキスト（日本語）
 */
async function appendEntry(attributesManager, role, text) {
  try {
    const persistentAttributes = await attributesManager.getPersistentAttributes() || {};
    const history = persistentAttributes.conversationHistory || { entries: [], lastUpdated: null };

    const ts = new Date().toISOString();
    const entry = { role: role, text: String(text || ''), timestamp: ts };

    history.entries = history.entries.concat([entry]);

    // 保持件数のトリム
    if (history.entries.length > MAX_ENTRIES) {
      history.entries = history.entries.slice(-MAX_ENTRIES);
    }

    // 合計文字数（JSON 文字列）での上限を守る
    let approxLen = JSON.stringify(history.entries).length;
    while (approxLen > MAX_TOTAL_CHARS && history.entries.length > 1) {
      history.entries.shift();
      approxLen = JSON.stringify(history.entries).length;
    }

    history.lastUpdated = ts;
    persistentAttributes.conversationHistory = history;

    attributesManager.setPersistentAttributes(persistentAttributes);
    await attributesManager.savePersistentAttributes();
  } catch (error) {
    console.log(`[ConversationHistoryService] appendEntry error: ${error}`);
  }
}

async function getHistory(attributesManager) {
  try {
    const persistentAttributes = await attributesManager.getPersistentAttributes() || {};
    return persistentAttributes.conversationHistory || { entries: [] };
  } catch (error) {
    console.log(`[ConversationHistoryService] getHistory error: ${error}`);
    return { entries: [] };
  }
}

async function clearHistory(attributesManager) {
  try {
    const persistentAttributes = await attributesManager.getPersistentAttributes() || {};
    if (persistentAttributes.conversationHistory) delete persistentAttributes.conversationHistory;
    attributesManager.setPersistentAttributes(persistentAttributes);
    await attributesManager.savePersistentAttributes();
  } catch (error) {
    console.log(`[ConversationHistoryService] clearHistory error: ${error}`);
  }
}

module.exports = {
  appendEntry,
  getHistory,
  clearHistory
};
