// lambda/__tests__/AIFallbackHandler.ollama.test.js
// Ollama をローカルで立ち上げているときに実行する統合テスト
// 実行方法（ローカル）:
// RUN_OLLAMA_TESTS=1 AI_ADAPTER=ollama OLLAMA_HOST=http://localhost:11434 npm test -- __tests__/AIFallbackHandler.ollama.test.js -i

const AIFallbackHandler = require('../handlers/AIFallbackHandler');
const ConversationHistoryService = require('../services/ConversationHistoryService');

// このテストはデフォルトではスキップします。実行するには環境変数 RUN_OLLAMA_TESTS=1 を設定してください。
const shouldRun = process.env.RUN_OLLAMA_TESTS === '1';

// テストのタイムアウトを長めに設定（モデル呼び出しのため）
jest.setTimeout(120000);

function makeAttributesManager(initialSession = {}, initialPersistent = {}) {
  let session = { ...initialSession };
  let persistent = { ...initialPersistent };
  return {
    getSessionAttributes: () => session,
    setSessionAttributes: (s) => { session = s; },
    getPersistentAttributes: async () => persistent,
    setPersistentAttributes: async (p) => { persistent = p; },
    savePersistentAttributes: async () => {},
    // helper for debugging in tests
    _getState: () => ({ session, persistent })
  };
}

function makeHandlerInput({ locale = 'ja-JP', sessionAttrs = {} } = {}) {
  const attributesManager = makeAttributesManager(sessionAttrs, {});
  const requestEnvelope = {
    request: {
      type: 'IntentRequest',
      locale,
      intent: { name: 'SomeUnknownIntent', slots: {} }
    },
    session: { sessionId: 'local-session' }
  };

  const built = {};
  const responseBuilder = {
    speak(text) { built.speak = text; return this; },
    reprompt(text) { built.reprompt = text; return this; },
    getResponse() { return built; }
  };

  return { requestEnvelope, attributesManager, responseBuilder };
}

// 実行を制御するラッパー（shouldRun に応じて test を飛ばす）
(shouldRun ? test : test.skip)('Ollama 統合テスト: AIFallbackHandler -> Ollama', async () => {
  // テストは Ollama が動いていることを前提とする
  // 環境例:
  // export AI_ADAPTER=ollama
  // export OLLAMA_HOST=http://localhost:11434
  // export OLLAMA_MODEL=gpt-oss:20b

  // Arrange: ハンドラ入力を作成し、会話履歴をシードする
  const hi = makeHandlerInput({ sessionAttrs: { cart: [{ id: 'p1', name: 'りんご', quantity: 1 }] } });

  // 会話履歴にユーザー発話を追加（日本語）
  await ConversationHistoryService.appendEntry(hi.attributesManager, 'USER', 'カートを見せて');
  await ConversationHistoryService.appendEntry(hi.attributesManager, 'ALEXA', 'カートを確認します');

  // Act: AIFallbackHandler に処理を委譲
  const res = await AIFallbackHandler.handle(hi);

  // 出力をログに出す（手動検査用）
  console.log('--- AIFallbackHandler (Ollama) response ---');
  console.log(res);
  console.log('-------------------------------------------');

  // Assert: 結果は何らかの応答オブジェクトであることを最低限確認
  expect(res).toBeDefined();
  // Alexa レスポンスは通常オブジェクト。応答に speak か spoken 等を含むか確認
  const hasSpeak = (res && (res.speak || res.spoken || (typeof res.outputSpeech === 'object')));
  expect(hasSpeak).toBeTruthy();
}, 120000);
