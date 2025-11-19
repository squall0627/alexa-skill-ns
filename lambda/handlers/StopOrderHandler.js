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
        const speak = '今回のご購入を中止しました。必要な場合はまた最初からご注文ください。';
        return handlerInput.responseBuilder.speak(speak).getResponse();
      }

      if (confirmationStatus === 'DENIED') {
        const speak = '注文中止をキャンセルしました。ほかに何をしますか？';
        return handlerInput.responseBuilder.speak(speak).reprompt('ほかに何をしますか？').getResponse();
      }

      // NONE -> set pending and ask
      // set generic pending flag
      sessionAttributes.pending = true;
      sessionAttributes.pendingData = { kind: 'stopOrder' };
      attributesManager.setSessionAttributes(sessionAttributes);
      const speak = '今回のご購入を中止してもよろしいですか？';
      const reprompt = '今回の購入を中止してもよろしいですか？ はいで中止、いいえで継続します。';
      return handlerInput.responseBuilder.speak(speak).reprompt(reprompt).getResponse();
    } finally {
      console.log('End handling StopOrderHandler');
    }
  }
};
