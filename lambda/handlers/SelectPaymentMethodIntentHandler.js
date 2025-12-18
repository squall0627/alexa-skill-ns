// lambda/handlers/SelectPaymentMethodIntentHandler.js
const Alexa = require('ask-sdk-core');
const PaymentService = require('../services/PaymentService');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    const intentName = Alexa.getIntentName(request);
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes() || {};
    // SelectDeliverySlotIntentHandler のスタイルに合わせる: 明示的な SelectPaymentMethodIntent を受け付ける
    // または lastAction === 'StartPaymentIntent' の場合に NumberOnlyIntent を受け付ける
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
      // 決済方法の選択を永続化するためにダーティフラグを立てる
      sessionAttributes._cartDirty = true;
      sessionAttributes.lastAction = 'SelectPaymentMethodIntent';
      attributesManager.setSessionAttributes(sessionAttributes);

      // WAON ポイント利用確認をサポートする決済方法の場合（例: 'aeon'）、まず残高をチェック
      const balance = await PaymentService.getWaonBalance(attributesManager);
      if (balance > 0) {
          sessionAttributes.pending = true;
          sessionAttributes.pendingData = { kind: 'confirmUseWaon' };
          // paymentFlow が変更された（次に pending）があるため、ダーティを維持
          sessionAttributes._cartDirty = true;
          attributesManager.setSessionAttributes(sessionAttributes);
          const speak = `WAONポイントの残高は${balance}ポイントあります。WAONポイントを利用しますか？ はい、またはいいえでお答えください。`;
          const { attachSpeechAndCard, buildGenericCard } = require('../utils/responseUtils');
          const card = buildGenericCard('WAONポイント残高', `残高: ${balance}ポイント`);
          const rb = attachSpeechAndCard(handlerInput.responseBuilder, speak, 'WAONポイントを利用しますか？', card);
          return rb.reprompt('WAONポイントを利用しますか？').getResponse();
      }

      // 次にオーナーズカード（株主優待カード）の確認を行う
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
