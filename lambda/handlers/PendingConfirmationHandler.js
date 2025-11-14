// lambda/handlers/PendingConfirmationHandler.js
// 日本語：降級確認（pendingClearCart / pendingCancelOrder）時に Yes/No を処理するハンドラ
const Alexa = require('ask-sdk-core');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    if (Alexa.getRequestType(request) !== 'IntentRequest') return false;
    const intentName = Alexa.getIntentName(request);
    if (intentName !== 'AMAZON.YesIntent' && intentName !== 'AMAZON.NoIntent') return false;
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes() || {};
    return Boolean(sessionAttributes.pendingClearCart || sessionAttributes.pendingCancelOrder);
  },
  async handle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    const intentName = Alexa.getIntentName(request);
    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes() || {};

    const isYes = intentName === 'AMAZON.YesIntent';
    const isNo = intentName === 'AMAZON.NoIntent';

    // Handle pendingClearCart
    const orderUtils = require('../utils/orderUtils');
    if (sessionAttributes.pendingClearCart) {
      // clear the pending flag either way
      delete sessionAttributes.pendingClearCart;

      if (isYes) {
        orderUtils.clearCartSession(attributesManager);
        const speak = 'カートを空にしました。ほかに何をしますか？';
        return handlerInput.responseBuilder.speak(speak).reprompt('ほかに何をしますか？').getResponse();
      } else {
        // No -> cancel
        attributesManager.setSessionAttributes(sessionAttributes);
        const speak = 'カートのクリアをキャンセルしました。ほかに何をしますか？';
        return handlerInput.responseBuilder.speak(speak).reprompt('ほかに何をしますか？').getResponse();
      }
    }

    // Handle pendingCancelOrder
    if (sessionAttributes.pendingStopOrder) {
      // clear flag
      delete sessionAttributes.pendingStopOrder;
      if (isYes) {
        await orderUtils.stopOrder(attributesManager);
        const speak = 'ご注文を中止しました。必要な場合はまた最初から注文を開始してください。';
        return handlerInput.responseBuilder.speak(speak).getResponse();
      } else {
        // No -> cancel
        attributesManager.setSessionAttributes(sessionAttributes);
        const speak = '注文の中止をキャンセルしました。ほかに何をしますか？';
        return handlerInput.responseBuilder.speak(speak).reprompt('ほかに何をしますか？').getResponse();
      }
    }

    // If somehow reached here, fallback
    return handlerInput.responseBuilder.speak('すみません、処理できませんでした。').getResponse();
  }
};
