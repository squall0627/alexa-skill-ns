// lambda/__tests__/AIFallbackHandler.test.js
const AIFallbackHandler = require('../handlers/AIFallbackHandler');
const ConversationHistoryService = require('../services/ConversationHistoryService');

function makeAttributesManager() {
  const persistent = {};
  const session = {};
  return {
    _persistent: persistent,
    _session: session,
    async getPersistentAttributes() { return this._persistent; },
    setPersistentAttributes(attrs) { this._persistent = attrs; },
    async savePersistentAttributes() {  },
    getSessionAttributes() { return this._session; },
    setSessionAttributes(attrs) { this._session = attrs; }
  };
}

function makeHandlerInput({ intentName = 'UnknownIntent', sessionAttrs = {}, locale = 'ja-JP' } = {}) {
  const attributesManager = makeAttributesManager();
  attributesManager.setSessionAttributes(sessionAttrs);

  const requestEnvelope = { request: { type: 'IntentRequest', intent: { name: intentName } , locale } };

  const built = {};
  const responseBuilder = {
    speak(text) { built.speak = text; return this; },
    reprompt(text) { built.reprompt = text; return this; },
    getResponse() { return built; }
  };

  return { requestEnvelope, attributesManager, responseBuilder };
}

describe('AIFallbackHandler and ConversationHistoryService', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('ConversationHistoryService append/get/clear', async () => {
    const attributesManager = makeAttributesManager();
    await ConversationHistoryService.appendEntry(attributesManager, 'USER', 'カートを見せて');
    await ConversationHistoryService.appendEntry(attributesManager, 'ALEXA', 'カートの中身をお見せします');
    const hist = await ConversationHistoryService.getHistory(attributesManager);
    expect(hist.entries.length).toBeGreaterThanOrEqual(2);
    // clear
    await ConversationHistoryService.clearHistory(attributesManager);
    const hist2 = await ConversationHistoryService.getHistory(attributesManager);
    expect(hist2.entries.length).toBe(0);
  });

  test('AI maps to ViewCartIntent and delegates to ViewCartIntentHandler', async () => {
    const session = { cart: [{ id: 'p1', name: 'リンゴ', quantity: 2, price: 100 }] };
    const hi = makeHandlerInput({ intentName: 'SomeUnknownIntent', sessionAttrs: session });

    // seed conversation history so mock adapter can match "カート"
    await ConversationHistoryService.appendEntry(hi.attributesManager, 'USER', 'カートを見せて');

    expect(AIFallbackHandler.canHandle(hi)).toBe(true);
    const res = await AIFallbackHandler.handle(hi);
    expect(res.speak).toMatch(/カートの中身/);
  });

  test('AI low confidence prompts user for clarification', async () => {
    const hi = makeHandlerInput({ intentName: 'SomeUnknownIntent', sessionAttrs: {} });
    // seed ambiguous conversation
    await ConversationHistoryService.appendEntry(hi.attributesManager, 'USER', 'よくわからない文言');

    const res = await AIFallbackHandler.handle(hi);
    expect(res.speak).toMatch(/よく理解できませんでした/);
  });
});

