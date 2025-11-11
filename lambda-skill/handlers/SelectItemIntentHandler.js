// handlers/SelectItemIntentHandler.js
// 日本語：アイテム選択 Intent（SelectItemIntent）専用ハンドラ。
const Alexa = require('ask-sdk-core');
const { postJson, toUserError } = require('../helpers/apiClient');

module.exports = {
  canHandle(handlerInput) {
    // 日本語：IntentRequest かつ SelectItemIntent のみ処理
    const request = handlerInput.requestEnvelope;
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'SelectItemIntent';
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
      const apiResp = await postJson('/select', {
        sessionId,
        slots,
        sessionAttributes,
      });

      // 日本語：セッション属性を更新
      if (apiResp.sessionAttributes && typeof apiResp.sessionAttributes === 'object') {
        attributesManager.setSessionAttributes(apiResp.sessionAttributes);
      }

      const speech = apiResp.spokenResponse || 'その番号の商品が見つかりませんでした。別の番号でお試しください。';
      const reprompt = apiResp.reprompt || '続けますか？';
      const shouldEnd = apiResp.shouldEndSession === true;

      const builder = handlerInput.responseBuilder.speak(speech);
      if (!shouldEnd) builder.reprompt(reprompt); else builder.withShouldEndSession(true);
      return builder.getResponse();
    } catch (e) {
      console.error('SelectItemIntent API error:', e);
      const err = toUserError();
      return handlerInput.responseBuilder.speak(err.spokenResponse).reprompt(err.reprompt).getResponse();
    }
  }
};
