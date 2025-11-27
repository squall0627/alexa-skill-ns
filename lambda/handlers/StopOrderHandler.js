// lambda/handlers/StopOrderHandler.js
// 日本語：今回の購入（オーダー）を中止し、関連する全ての注文情報を初期化するハンドラ
const Alexa = require('ask-sdk-core');
const orderUtils = require('../utils/orderUtils');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'StopOrderIntent';
  },
  async handle(handlerInput) {
    console.log('Start handling StopOrderHandler');
    try {
      const request = handlerInput.requestEnvelope;
      const attributesManager = handlerInput.attributesManager;

      // mark last action as this intent
      const sessionAttributes = attributesManager.getSessionAttributes() || {};
      const { markLastAction } = require('../utils/sessionUtils');
      markLastAction(handlerInput, 'StopOrderIntent');

      const intent = request.request.intent || {};
      const confirmationStatus = intent.confirmationStatus || 'NONE';

      if (confirmationStatus === 'CONFIRMED') {
        await orderUtils.stopOrder(attributesManager);
        const plain = '今回のご購入を中止しました。必要な場合はまた最初からご注文ください。';
        const ssml = `<speak>今回のご購入を中止しました。必要な場合はまた最初からご注文ください。</speak>`;
        const rb = handlerInput.responseBuilder.speak(ssml);
        if (typeof rb.withSimpleCard === 'function') rb.withSimpleCard('注文中止', plain);
        return rb.getResponse();
      }

      if (confirmationStatus === 'DENIED') {
        const plain = '注文中止をキャンセルしました。ほかに何をしますか？';
        const ssml = `<speak>注文中止をキャンセルしました。ほかに何をしますか？</speak>`;
        const rb = handlerInput.responseBuilder.speak(ssml).reprompt('ほかに何をしますか？');
        if (typeof rb.withSimpleCard === 'function') rb.withSimpleCard('注文継続', plain);
        return rb.getResponse();
      }

      // NONE -> set pending and ask
      // set generic pending flag
      sessionAttributes.pending = true;
      sessionAttributes.pendingData = { kind: 'stopOrder' };
      attributesManager.setSessionAttributes(sessionAttributes);
      const plain = '今回のご購入を中止してもよろしいですか？';
      const reprompt = '今回の購入を中止してもよろしいですか？ はいで中止、いいえで継続します。';
      const ssml = `<speak>${plain}</speak>`;
      const rb = handlerInput.responseBuilder.speak(ssml).reprompt(reprompt);
      if (typeof rb.withSimpleCard === 'function') rb.withSimpleCard('注文中止の確認', plain);
      return rb.getResponse();
    } finally {
      console.log('End handling StopOrderHandler');
    }
  }
};
