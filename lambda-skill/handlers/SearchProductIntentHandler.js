// handlers/SearchProductIntentHandler.js
// 日本語：商品検索 Intent（SearchProductIntent）専用ハンドラ。
const Alexa = require('ask-sdk-core');
const { postJson, toUserError } = require('../helpers/apiClient');

module.exports = {
  canHandle(handlerInput) {
    // 日本語：IntentRequest かつ SearchProductIntent のみ処理
    const request = handlerInput.requestEnvelope;
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'SearchProductIntent';
  },
  async handle(handlerInput) {
    // 日本語：スロットとセッション属性を収集して API へ委譲
    const requestEnvelope = handlerInput.requestEnvelope;
    const intent = requestEnvelope.request.intent || { slots: {} };
    const slots = intent.slots ? Object.fromEntries(Object.entries(intent.slots).map(([k, v]) => [k, v && v.value])) : {};

    const sessionId = requestEnvelope.session ? requestEnvelope.session.sessionId : 'unknown';
    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes() || {};

    try {
      const apiResp = await postJson('/search/products', {
        sessionId,
        slots,
        userText: requestEnvelope.request.inputTranscript || '',
        sessionAttributes,
      });

      // 日本語：セッション属性を更新
      if (apiResp.sessionAttributes && typeof apiResp.sessionAttributes === 'object') {
        attributesManager.setSessionAttributes(apiResp.sessionAttributes);
      }

      const speech = apiResp.spokenResponse || '該当商品が見つかりませんでした。何を検索しますか？';
      const reprompt = apiResp.reprompt || '続けますか？';
      const shouldEnd = apiResp.shouldEndSession === true;

      const builder = handlerInput.responseBuilder.speak(speech);
      if (!shouldEnd) builder.reprompt(reprompt); else builder.withShouldEndSession(true);
      return builder.getResponse();
    } catch (e) {
      console.error('SearchProductIntent API error:', e);
      const err = toUserError();
      return handlerInput.responseBuilder.speak(err.spokenResponse).reprompt(err.reprompt).getResponse();
    }
  }
};
