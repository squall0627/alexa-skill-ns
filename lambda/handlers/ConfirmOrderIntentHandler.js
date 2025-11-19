// ...new file...
// lambda/handlers/ConfirmOrderIntentHandler.js
const Alexa = require('ask-sdk-core');
const PaymentService = require('../services/PaymentService');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    const intentName = Alexa.getIntentName(request);
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes() || {};
    // Accept explicit ConfirmOrderIntent or when lastAction was set to 'ConfirmOrderIntent'
    return Alexa.getRequestType(request) === 'IntentRequest' && intentName === 'ConfirmOrderIntent' && sessionAttributes.lastAction === 'ConfirmOrderIntent';
  },

  async handle(handlerInput) {
    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes() || {};

    // Build a readable order summary in Japanese
    const cart = sessionAttributes.cart || [];
    if (!Array.isArray(cart) || cart.length === 0) {
      const speak = 'カートに商品がありません。注文を確定できません。ほかに何をしますか？';
      return handlerInput.responseBuilder.speak(speak).reprompt('ほかに何をしますか？').getResponse();
    }

    const itemsText = cart.map((it, i) => `番号${i + 1}、${it.name || it.title || '商品'}、${it.quantity || 1}個、単価${it.price || it.unitPrice || 0}円`).join('。 ');

    const delivery = sessionAttributes.cartDelivery ? sessionAttributes.cartDelivery.spokenLabel : (sessionAttributes.cartDeliveryAddress ? sessionAttributes.cartDeliveryAddress.spokenLabel : '未設定の配送');
    const promo = sessionAttributes.appliedPromo ? sessionAttributes.appliedPromo.name : 'クーポン未使用';
    const paymentFlow = sessionAttributes.paymentFlow || {};
    const methodLabel = (paymentFlow.method === 'cash' && '現金') || (paymentFlow.method === 'credit' && 'クレジットカード') || (paymentFlow.method === 'aeon' && 'イオンペイ') || '未設定';
    const waonUse = paymentFlow.useWaon ? `WAONポイントを${paymentFlow.waonPoints || 0}ポイント使用` : 'WAONポイント未使用';
    const share = paymentFlow.useShareholderCard ? '株主優待カードを使用' : '株主優待カード未使用';

    const computed = await PaymentService.computeFinalAmounts(attributesManager, sessionAttributes);

    // Assemble full summary
    const speak = `ご注文の確認です。商品：${itemsText}。配達：${delivery}。クーポン：${promo}。お支払い方法：${methodLabel}。${waonUse}。${share}。${computed.summary} 注文を確定してよろしいですか？`;

    // set pending for final confirmation handled by PendingConfirmationHandler
    sessionAttributes.pending = true;
    sessionAttributes.pendingData = { kind: 'confirmFinalizePayment' };
    sessionAttributes.lastAction = 'ConfirmOrderIntent';
    attributesManager.setSessionAttributes(sessionAttributes);

    return handlerInput.responseBuilder.speak(speak).reprompt('注文を確定してよろしいですか？ はい／いいえでお答えください。').getResponse();
  }
};

