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
    // handle only when generic pending flag is set and lastAction indicates a confirmation-type intent
    const pendingData = sessionAttributes.pendingData || {};
    return Boolean(sessionAttributes.pending && ((sessionAttributes.lastAction === 'ClearCartIntent' && pendingData.kind === 'clearCart') || (sessionAttributes.lastAction === 'StopOrderIntent' && pendingData.kind === 'stopOrder')));
  },
  async handle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    const intentName = Alexa.getIntentName(request);
    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes() || {};

    const isYes = intentName === 'AMAZON.YesIntent';
    // const isNo not needed; use else branch where appropriate

    // Handle pendingClearCart
    const orderUtils = require('../utils/orderUtils');
    // Determine which confirmation is pending based on lastAction
    const pendingData = sessionAttributes.pendingData || {};
    if (sessionAttributes.pending && sessionAttributes.lastAction === 'ClearCartIntent' && pendingData.kind === 'clearCart') {
      // clear the generic pending flag
      delete sessionAttributes.pending;
      delete sessionAttributes.pendingData;

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

    if (sessionAttributes.pending && sessionAttributes.lastAction === 'StopOrderIntent' && pendingData.kind === 'stopOrder') {
      // clear pending
      delete sessionAttributes.pending;
      delete sessionAttributes.pendingData;
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
