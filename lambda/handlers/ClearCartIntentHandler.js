// lambda/handlers/ClearCartIntentHandler.js
// 日本語：カートの中身だけをクリアするハンドラ（確認フロー対応）
const Alexa = require('ask-sdk-core');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'ClearCartIntent';
  },
  handle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes() || {};

    // Check built-in confirmation status (if interaction model uses confirmation)
    const intent = request.request.intent || {};
    const confirmationStatus = intent.confirmationStatus || 'NONE';

    if (confirmationStatus === 'CONFIRMED') {
      // perform clear using shared util
      const orderUtils = require('../utils/orderUtils');
      orderUtils.clearCartSession(attributesManager);

      const speak = 'カートを空にしました。ほかに何をしますか？';
      return handlerInput.responseBuilder.speak(speak).reprompt('ほかに何をしますか？').getResponse();
    }

    if (confirmationStatus === 'DENIED') {
      const speak = 'カートのクリアをキャンセルしました。ほかに何をしますか？';
      return handlerInput.responseBuilder.speak(speak).reprompt('ほかに何をしますか？').getResponse();
    }

    // confirmationStatus === 'NONE' -> ask for confirmation and set pending flag
    sessionAttributes.pendingClearCart = true;
    attributesManager.setSessionAttributes(sessionAttributes);

    const speak = 'カートの中身を全部消してもよろしいですか？';
    const reprompt = 'カートを空にしてもよいですか？ はい、で確定、いいえ、で中止します。';
    return handlerInput.responseBuilder.speak(speak).reprompt(reprompt).getResponse();
  }
};
