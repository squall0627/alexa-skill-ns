// lambda/handlers/SelectPaymentMethodIntentHandler.js
const Alexa = require('ask-sdk-core');
const PaymentService = require('../services/PaymentService');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    const intentName = Alexa.getIntentName(request);
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes() || {};
    // Mirror SelectDeliverySlotIntentHandler style: accept explicit SelectPaymentMethodIntent
    // or NumberOnlyIntent when lastAction === 'StartPaymentIntent'
    return (Alexa.getRequestType(request) === 'IntentRequest' && intentName === 'SelectPaymentMethodIntent' && sessionAttributes.lastAction === 'StartPaymentIntent');
  },

  async handle(handlerInput) {
    console.log('Start handling SelectPaymentMethodIntentHandler');
    try {
      const requestEnvelope = handlerInput.requestEnvelope;
      const intent = requestEnvelope.request.intent || { slots: {} };
      const slots = intent.slots || {};
      const numberValue = (slots.PaymentNumber && slots.PaymentNumber.value) || (slots.Number && slots.Number.value) || null;

      const attributesManager = handlerInput.attributesManager;
      const sessionAttributes = attributesManager.getSessionAttributes() || {};

      const methods = PaymentService.getPaymentMethods();
      const idx = Number(numberValue);
      if (!Number.isInteger(idx) || idx < 1 || idx > methods.length) {
        const speak = `申し訳ありません。番号は1から${methods.length}の間で教えてください。もう一度お支払い方法を番号で教えてください。`;
        return handlerInput.responseBuilder.speak(speak).reprompt('お支払い方法を番号で教えてください。').getResponse();
      }

      const selected = methods[idx - 1];
      sessionAttributes.paymentFlow = sessionAttributes.paymentFlow || {};
      sessionAttributes.paymentFlow.method = selected.id;
      sessionAttributes.paymentFlow.status = 'methodSelected';
      sessionAttributes.lastAction = 'SelectPaymentMethodIntent';
      attributesManager.setSessionAttributes(sessionAttributes);

      // If payment method supports WAON points question (assume aeon/waon integration for 'aeon')
      // check balance first
      const balance = await PaymentService.getWaonBalance(attributesManager);
      if (balance > 0) {
          sessionAttributes.pending = true;
          sessionAttributes.pendingData = { kind: 'confirmUseWaon' };
          attributesManager.setSessionAttributes(sessionAttributes);
          const speak = `WAONポイントの残高は${balance}ポイントあります。WAONポイントを利用しますか？ はい、またはいいえでお答えください。`;
          return handlerInput.responseBuilder.speak(speak).reprompt('WAONポイントを利用しますか？').getResponse();
      }

      // Otherwise ask about shareholder card next
      sessionAttributes.pending = true;
      sessionAttributes.pendingData = { kind: 'confirmShareholderCard' };
      attributesManager.setSessionAttributes(sessionAttributes);
      const speak = `支払い方法を${selected.label}に設定しました。オーナーズカードをお持ちですか？ はい、またはいいえでお答えください。`;
      return handlerInput.responseBuilder.speak(speak).reprompt('オーナーズカードをお持ちですか？').getResponse();
    } finally {
      console.log('End handling SelectPaymentMethodIntentHandler');
    }
  }
};
