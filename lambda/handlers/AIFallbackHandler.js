// lambda/handlers/AIFallbackHandler.js
// AI フォールバックハンドラー
// 目的: 既存ハンドラがマッチしなかった発話を受け、会話履歴とインテント定義を使って最適なインテントを判定する
// ユーザー向けの発話とコードコメントは日本語。AIへの prompt は英語。

const Alexa = require('ask-sdk-core');
const fs = require('fs');
const path = require('path');
const { createAdapter } = require('../adapters/AIAdapter');
const ConversationHistoryService = require('../services/ConversationHistoryService');

// confidence threshold
const CONFIDENCE_THRESHOLD = 0.6;

function loadIntentDefinitions() {
  try {
    // 首先尝试 lambda/.. 相对路径
    let imPath = path.join(__dirname, '..', 'skill-package', 'interactionModels', 'custom', 'ja-JP.json');
    if (!fs.existsSync(imPath)) {
      // 退回到仓库根目录的 skill-package
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

// Build English prompt for AI: include recent conversation + intent list
function buildPrompt(conversationEntries, intents) {
  // Put instruction in English per requirement
  // 强化的提示：严格输出 JSON，仅返回指定字段；如果没有匹配则返回 intent:null 和 sample:null
  const header = `You are given a short conversation between a user and an Alexa shopping skill (in Japanese). Choose the best matching intent from the provided list of intents. REQUIRED: Output JSON ONLY, and NOTHING ELSE. The JSON must have these keys:
  - intent: the exact intent name from the provided list (string), or null if none matches.
  - sample: a single representative sample utterance in Japanese that the skill would accept for that intent (string), or null if intent is null.
  - confidence: a float between 0 and 1 indicating your confidence in the mapping.
  - slots: optional object mapping slotName -> value (strings), include only when you are confident.

  If there is no suitable intent, return {"intent": null, "sample": null, "confidence": 0}. Do NOT add any explanatory text, commentary, or additional keys. Respond with valid JSON only.`;
  // Add explicit JSON examples to prompt to further constrain output format
  const examples = `\n\nEXAMPLES:\n1) Matched intent example:\n{ "intent": "ViewCartIntent", "sample": "カートを見せて", "confidence": 0.95 }\n\n2) No-match example:\n{ "intent": null, "sample": null, "confidence": 0 }\n`;

  // Include conversation: include latest up to 10 entries
  const recent = conversationEntries.slice(-10).map(e => `${e.role}: ${e.text}`).join('\n');

  // Intent list lines
  const intentLines = intents.map(it => `- ${it.name}: samples => ${Array.isArray(it.samples) ? it.samples.join(' | ') : ''}`).join('\n');

  const prompt = `${header}${examples}\nConversation:\n${recent}\n\nIntents:\n${intentLines}\n\nRespond with JSON.`;
  // Optional debug: when DEBUG_AI env var is set, print the prompt
  if (process.env.DEBUG_AI) console.log('[AIFallbackHandler] AI prompt:\n', prompt);
  return prompt;
}

module.exports = {
  canHandle(handlerInput) {
    // This handler acts as a last-resort fallback: it should run when an IntentRequest
    // is received but none of the specific handlers matched. The Skill builder will
    // call this handler if placed appropriately in the chain.
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
  },

  async handle(handlerInput) {
    console.log('Start handling AIFallbackHandler');
    try {
      const attributesManager = handlerInput.attributesManager;

      // Get conversation history
      const history = await ConversationHistoryService.getHistory(attributesManager);
      const entries = history.entries || [];

      // Use cached intent definitions
      const intents = CACHED_INTENTS || [];
      const prompt = buildPrompt(entries, intents);

      // Create AI Adapter and call
      const adapter = createAdapter();
      let result = null;
      try {
        result = await adapter.call(prompt)
          console.log('[AIFallbackHandler] AI adapter call succeeded:', result);
      } catch (e) {
        console.log('[AIFallbackHandler] AI adapter call failed:', e);
      }

      if (!result || !result.intent || result.confidence < CONFIDENCE_THRESHOLD) {
        // 低信心 -> 引導ユーザーに再度聞き返す
        const speak = '申し訳ありません。よく理解できませんでした。もう少し詳しく教えていただけますか？';
        const reprompt = '例えば「カートを見せて」と言ってください。';
        return handlerInput.responseBuilder.speak(speak).reprompt(reprompt).getResponse();
      }

      // 高信心 -> 模擬的にインテントリクエストを発行する
      const intentName = result.intent;
      const sampleUtterance = result.sample || '';
      const providedSlots = result.slots || null; // expect shape: { SlotName: 'value', ... }

      // 保存：ユーザー说的原文也已由 RequestConversationInterceptor 保存；我们也把 AI 转换后的 sample 作为一条ユーザー意図记录
      await ConversationHistoryService.appendEntry(attributesManager, 'USER', sampleUtterance);

      // 构造一个フェイクの handlerInput を作成して、既存のハンドラに委譲する
      // 最も簡単なのは、既存の dispatch を呼び出すことだが、ここでは Alexa.SkillBuilders の内部ルーティングを呼ぶのは難しいため
      // 以下の方法：同一プロセス内で、そのインテント名に対応するハンドラモジュールを require して handle を呼ぶ。

      // Try to require handler module by naming convention: map intentName -> handlers/<IntentName>Handler.js
      const handlerModulePath = path.join(__dirname, `${intentName}Handler.js`);
      if (fs.existsSync(handlerModulePath)) {
        try {
          const targetHandler = require(handlerModulePath);
          // Build a fake request envelope representing the new intent invocation
          const fakeHandlerInput = Object.assign({}, handlerInput, {
            requestEnvelope: JSON.parse(JSON.stringify(handlerInput.requestEnvelope))
          });
          // Map providedSlots into Alexa slot format if present
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

          // Call the handler's handle
          if (targetHandler && typeof targetHandler.handle === 'function') {
            return await targetHandler.handle(fakeHandlerInput);
          }
        } catch (e) {
          console.log('[AIFallbackHandler] Failed to delegate to specific handler module:', e);
        }
      }

      // If cannot require module, fallback to a generic response indicating delegation
      const speak = `了解しました。${sampleUtterance} のご要望ですね。処理を試みます。`;
      return handlerInput.responseBuilder.speak(speak).getResponse();

    } finally {
      console.log('End handling AIFallbackHandler');
    }
  }
};
