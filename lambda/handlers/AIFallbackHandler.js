// lambda/handlers/AIFallbackHandler.js
// AI フォールバックハンドラー
// 目的: 既存ハンドラがマッチしなかった発話を受け、会話履歴とインテント定義を使って最適なインテントを判定する
// ユーザー向けの発話とコードコメントは日本語。AIへの prompt は英語。

const Alexa = require('ask-sdk-core');
const fs = require('fs');
const path = require('path');
const { createAdapter } = require('../adapters/AIAdapter');
const ConversationHistoryService = require('../services/ConversationHistoryService');

// 信頼度の閾値
const CONFIDENCE_THRESHOLD = 0.6;

function loadIntentDefinitions() {
  try {
    // まず lambda/.. の相対パスを試す
    let imPath = path.join(__dirname, '..', 'skill-package', 'interactionModels', 'custom', 'ja-JP.json');
    if (!fs.existsSync(imPath)) {
      // リポジトリルートの skill-package を試す
      imPath = path.join(__dirname, '..', '..', 'skill-package', 'interactionModels', 'custom', 'ja-JP.json');
    }
    if (!fs.existsSync(imPath)) return [];
    const raw = fs.readFileSync(imPath, 'utf8');
    const parsed = JSON.parse(raw);
    const intents = (parsed && parsed.interactionModel && parsed.interactionModel.languageModel && parsed.interactionModel.languageModel.intents) || [];
    return intents.map(i => ({ name: i.name, samples: i.samples || [] }));
  } catch (e) {
    console.log('[AIFallbackHandler] Failed to load intent definitions:', e);
    return [];
  }
}

// キャッシュされたインテント定義（モジュールロード時に一度だけ読み込む）
const CACHED_INTENTS = loadIntentDefinitions();

// AI に渡すプロンプトを構築（会話履歴 + インテント一覧を含む）
function buildPrompt(conversationEntries, intents) {
  // 指示文は英語で記述（仕様のため）
  // 出力は JSON のみで、指定フィールド以外を含めないよう明確に指示する
  const header = `You are given a short conversation between a user and an Alexa shopping skill (in Japanese). Choose the best matching intent from the provided list of intents. REQUIRED: Output JSON ONLY, and NOTHING ELSE. The JSON must have these keys:
  - intent: the exact intent name from the provided list (string), or null if none matches.
  - sample: a single representative sample utterance in Japanese that the skill would accept for that intent (string), or null if intent is null.
  - confidence: a float between 0 and 1 indicating your confidence in the mapping.
  - slots: optional object mapping slotName -> value (strings), include only when you are confident.

  If there is no suitable intent, return {"intent": null, "sample": null, "confidence": 0}. Do NOT add any explanatory text, commentary, or additional keys. Respond with valid JSON only.`;
  // さらに出力形式の制約を強めるための JSON 例を追加
  const examples = `\n\nEXAMPLES:\n1) Matched intent example:\n{ "intent": "ViewCartIntent", "sample": "カートを見せて", "confidence": 0.95 }\n\n2) No-match example:\n{ "intent": null, "sample": null, "confidence": 0 }\n`;

  // 会話履歴：最新 10 件を含める
  const recent = conversationEntries.slice(-10).map(e => `${e.role}: ${e.text}`).join('\n');

  // インテント一覧行
  const intentLines = intents.map(it => `- ${it.name}: samples => ${Array.isArray(it.samples) ? it.samples.join(' | ') : ''}`).join('\n');

  const prompt = `${header}${examples}\nConversation:\n${recent}\n\nIntents:\n${intentLines}\n\nRespond with JSON.`;
  // デバッグ用：DEBUG_AI 環境変数が設定されていればプロンプトを出力
  if (process.env.DEBUG_AI) console.log('[AIFallbackHandler] AI prompt:\n', prompt);
  return prompt;
}

module.exports = {
  canHandle(handlerInput) {
    // このハンドラは最終手段として機能します: IntentRequest を受け、他のハンドラがマッチしなかった場合に実行される想定です。
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
  },

  async handle(handlerInput) {
    console.log('Start handling AIFallbackHandler');
    try {
      const attributesManager = handlerInput.attributesManager;

      // 会話履歴を取得
      const history = await ConversationHistoryService.getHistory(attributesManager);
      const entries = history.entries || [];

      // キャッシュされたインテント定義を使用
      const intents = CACHED_INTENTS || [];
      const prompt = buildPrompt(entries, intents);

      // AI アダプタを生成して呼び出す
      const adapter = createAdapter();
      let result = null;
      try {
        result = await adapter.call(prompt)
          console.log('[AIFallbackHandler] AI adapter call succeeded:', result);
      } catch (e) {
        console.log('[AIFallbackHandler] AI adapter call failed:', e);
      }

      if (!result || !result.intent || result.confidence < CONFIDENCE_THRESHOLD) {
        // 信頼度が低い場合はユーザーに聞き返す
        const speak = '申し訳ありません。よく理解できませんでした。もう少し詳しく教えていただけますか？';
        const reprompt = '例えば「カートを見せて」と言ってください。';
        return handlerInput.responseBuilder.speak(speak).reprompt(reprompt).getResponse();
      }

      // 信頼度が高ければ、模擬的にインテントを発行して該当ハンドラに委譲する
      const intentName = result.intent;
      const sampleUtterance = result.sample || '';
      const providedSlots = result.slots || null; // expect shape: { SlotName: 'value', ... }

      // 保存：ユーザーの元発話は RequestConversationInterceptor により保存済み；ここでは AI が返ったサンプルをユーザー発話として追加
      await ConversationHistoryService.appendEntry(attributesManager, 'USER', sampleUtterance);

      // ハンドラーモジュールを require して handle を呼ぶ方法で委譲を試みる
      const handlerModulePath = path.join(__dirname, `${intentName}Handler.js`);
      if (fs.existsSync(handlerModulePath)) {
        try {
          const targetHandler = require(handlerModulePath);
          // フェイクの handlerInput を作成して既存ハンドラに渡す
          const fakeHandlerInput = Object.assign({}, handlerInput, {
            requestEnvelope: JSON.parse(JSON.stringify(handlerInput.requestEnvelope))
          });
          // providedSlots を Alexa の slots フォーマットに変換
          const slotsObj = {};
          if (providedSlots && typeof providedSlots === 'object') {
            Object.keys(providedSlots).forEach(k => {
              const v = providedSlots[k];
              slotsObj[k] = { name: k, value: String(v) };
            });
          }

          fakeHandlerInput.requestEnvelope.request = {
            type: 'IntentRequest',
            requestId: `amzn1.echo-api.request.${Date.now()}`,
            timestamp: new Date().toISOString(),
            locale: handlerInput.requestEnvelope.request.locale,
            intent: { name: intentName, confirmationStatus: 'NONE', slots: Object.keys(slotsObj).length ? slotsObj : {} },
            dialogState: 'COMPLETED'
          };

          // ハンドラの handle を呼び出す
          if (targetHandler && typeof targetHandler.handle === 'function') {
            return await targetHandler.handle(fakeHandlerInput);
          }
        } catch (e) {
          console.log('[AIFallbackHandler] Failed to delegate to specific handler module:', e);
        }
      }

      // ハンドラモジュールに委譲できない場合は汎用レスポンスを返す
      const speak = `了解しました。${sampleUtterance} のご要望ですね。処理を試みます。`;
      return handlerInput.responseBuilder.speak(speak).getResponse();

    } finally {
      console.log('End handling AIFallbackHandler');
    }
  }
};
