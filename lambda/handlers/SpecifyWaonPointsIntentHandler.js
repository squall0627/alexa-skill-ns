// lambda/handlers/SpecifyWaonPointsIntentHandler.js
const Alexa = require('ask-sdk-core');
const PaymentService = require('../services/PaymentService');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    const intentName = Alexa.getIntentName(request);
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes() || {};
    // Mirror SelectDeliverySlotIntentHandler style: accept explicit SpecifyWaonPointsIntent
    // or NumberOnlyIntent when lastAction === 'SpecifyWaonPointsIntent'
    return (Alexa.getRequestType(request) === 'IntentRequest' && intentName === 'SpecifyWaonPointsIntent' && (sessionAttributes.lastAction === 'SpecifyWaonPointsIntent' || sessionAttributes.lastAction === 'SelectPaymentMethodIntent'));
  },

  async handle(handlerInput) {
    const requestEnvelope = handlerInput.requestEnvelope;
    const intent = requestEnvelope.request.intent || { slots: {} };
    const slots = intent.slots || {};
    const numberValue = (slots.Points && slots.Points.value) || (slots.Number && slots.Number.value) || null;

    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes() || {};

    const points = Number(numberValue);
    const validation = await PaymentService.validateWaonPoints(attributesManager, points);
    if (!validation.ok) {
      if (validation.reason === 'invalid') {
        const speak = '申し訳ありません。ポイント数は整数で教えてください。何ポイント使いますか？';
        return handlerInput.responseBuilder.speak(speak).reprompt('使うポイント数を数字で教えてください。').getResponse();
      }
      if (validation.reason === 'insufficient') {
        const speak = `申し訳ありません。利用可能なポイントは${validation.balance}ポイントです。何ポイント使いますか？`;
        return handlerInput.responseBuilder.speak(speak).reprompt('使うポイント数を数字で教えてください。').getResponse();
      }
    }

    // Save points
    sessionAttributes.paymentFlow = sessionAttributes.paymentFlow || {};
    sessionAttributes.paymentFlow.useWaon = true;
    sessionAttributes.paymentFlow.waonPoints = points;
    sessionAttributes.lastAction = 'SpecifyWaonPointsIntent';

    // After points specified, ask about shareholder card
    sessionAttributes.pending = true;
    sessionAttributes.pendingData = { kind: 'confirmShareholderCard' };
    attributesManager.setSessionAttributes(sessionAttributes);

    // Compute interim summary
    const computed = await PaymentService.computeFinalAmounts(attributesManager, sessionAttributes);
    const speak = `${points}ポイントを使用します。現在の支払合計は${computed.totalAfterPoints}円です。株主優待カードを利用しますか？ はい、またはいいえでお答えください。`;
    return handlerInput.responseBuilder.speak(speak).reprompt('株主優待カードを利用しますか？').getResponse();
  }
};
