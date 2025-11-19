// lambda/handlers/PendingConfirmationHandler.js
// 日本語：降級確認（pendingClearCart / pendingCancelOrder）時に Yes/No を処理するハンドラ
const Alexa = require('ask-sdk-core');
const DeliveryAddressService = require('../services/DeliveryAddressService');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    if (Alexa.getRequestType(request) !== 'IntentRequest') return false;
    const intentName = Alexa.getIntentName(request);
    if (intentName !== 'AMAZON.YesIntent' && intentName !== 'AMAZON.NoIntent') return false;
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes() || {};
    // handle only when generic pending flag is set and lastAction indicates a confirmation-type intent
    const pendingData = sessionAttributes.pendingData || {};
    return Boolean(sessionAttributes.pending && ((sessionAttributes.lastAction === 'ClearCartIntent' && pendingData.kind === 'clearCart') || (sessionAttributes.lastAction === 'StopOrderIntent' && pendingData.kind === 'stopOrder') || (sessionAttributes.lastAction === 'SearchAvailableDeliveryAddressIntent' && pendingData.kind === 'confirmDefaultAddress')));
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
    // Determine which confirmation is pending based on pendingData.kind
    const pendingData = sessionAttributes.pendingData || {};
    if (sessionAttributes.pending && pendingData.kind === 'clearCart') {
      // clear the generic pending flag
      delete sessionAttributes.pending;
      delete sessionAttributes.pendingData;

      if (isYes) {
        // persist the cleared pending state before calling orderUtils
        attributesManager.setSessionAttributes(sessionAttributes);
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

    if (sessionAttributes.pending && pendingData.kind === 'stopOrder') {
      // clear pending
      delete sessionAttributes.pending;
      delete sessionAttributes.pendingData;
      if (isYes) {
        attributesManager.setSessionAttributes(sessionAttributes);
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

    // Handle confirming default/single delivery address
    if (sessionAttributes.pending && pendingData.kind === 'confirmDefaultAddress' && sessionAttributes.lastAction === 'SearchAvailableDeliveryAddressIntent') {
      // clear pending
      delete sessionAttributes.pending;
      delete sessionAttributes.pendingData;

      if (isYes) {
        // get address by index
        const addrIndex = pendingData.addressIndex || 1;
        const address = await DeliveryAddressService.getAddressByIndex(attributesManager, addrIndex);
        if (address) {
          sessionAttributes.cartDeliveryAddress = address;
          sessionAttributes._cartDirty = true;
          attributesManager.setSessionAttributes(sessionAttributes);
          const speak = `配送先を ${address.spokenLabel} に設定しました。お支払いに進みますか？`;
          return handlerInput.responseBuilder.speak(speak).reprompt('お支払いに進みますか？').getResponse();
        } else {
          attributesManager.setSessionAttributes(sessionAttributes);
          const speak = '申し訳ありません。配送先を設定できませんでした。もう一度やり直してください。';
          return handlerInput.responseBuilder.speak(speak).reprompt('もう一度お願いします。').getResponse();
        }
      } else {
        // No -> cancel
        attributesManager.setSessionAttributes(sessionAttributes);
        const speak = '配送先の設定をキャンセルしました。ほかに何をしますか？';
        return handlerInput.responseBuilder.speak(speak).reprompt('ほかに何をしますか？').getResponse();
      }
    }

    // If somehow reached here, fallback
    return handlerInput.responseBuilder.speak('すみません、処理できませんでした。').getResponse();
  }
};
