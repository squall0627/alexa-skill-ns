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
        const { attachSpeechAndCard, buildGenericCard } = require('../utils/responseUtils');
        const card = buildGenericCard('番号が範囲外です', speak);
        const rb = attachSpeechAndCard(handlerInput.responseBuilder, speak, '番号が範囲外です', card);
        return rb.reprompt('お支払い方法を番号で教えてください。').getResponse();
      }

      const selected = methods[idx - 1];
      sessionAttributes.paymentFlow = sessionAttributes.paymentFlow || {};
      sessionAttributes.paymentFlow.method = selected.id;
      sessionAttributes.paymentFlow.status = 'methodSelected';
      // mark dirty so payment method selection is persisted
      sessionAttributes._cartDirty = true;
      sessionAttributes.lastAction = 'SelectPaymentMethodIntent';
      attributesManager.setSessionAttributes(sessionAttributes);

      // If payment method supports WAON points question (assume aeon/waon integration for 'aeon')
      // check balance first
      const balance = await PaymentService.getWaonBalance(attributesManager);
      if (balance > 0) {
          sessionAttributes.pending = true;
          sessionAttributes.pendingData = { kind: 'confirmUseWaon' };
          // paymentFlow modified (pending next), keep dirty
          sessionAttributes._cartDirty = true;
          attributesManager.setSessionAttributes(sessionAttributes);
          const speak = `WAONポイントの残高は${balance}ポイントあります。WAONポイントを利用しますか？ はい、またはいいえでお答えください。`;
          const { attachSpeechAndCard, buildGenericCard } = require('../utils/responseUtils');
          const card = buildGenericCard('WAONポイント残高', `残高: ${balance}ポイント`);
          const rb = attachSpeechAndCard(handlerInput.responseBuilder, speak, 'WAONポイントを利用しますか？', card);
          return rb.reprompt('WAONポイントを利用しますか？').getResponse();
      }

      // Otherwise ask about shareholder card next
      sessionAttributes.pending = true;
      sessionAttributes.pendingData = { kind: 'confirmShareholderCard' };
      sessionAttributes._cartDirty = true;
      attributesManager.setSessionAttributes(sessionAttributes);
      const speak = `支払い方法を${selected.label}に設定しました。オーナーズカードをお使いますか？ はい、またはいいえでお答えください。`;
      const { attachSpeechAndCard, buildGenericCard } = require('../utils/responseUtils');
      const card = buildGenericCard('支払い方法を設定しました', `支払い方法: ${selected.label}`);
      const rb = attachSpeechAndCard(handlerInput.responseBuilder, speak, '支払い方法を設定しました', card);
      return rb.reprompt('オーナーズカードをお使いますか？').getResponse();
    } finally {
      console.log('End handling SelectPaymentMethodIntentHandler');
    }
  }
};
