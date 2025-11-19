// lambda/handlers/NumberOnlyIntentHandler.js
// Captures utterances that are only a number and routes them to the correct handler
// based on sessionAttributes.lastAction and pendingData.
const Alexa = require('ask-sdk-core');

const ProvideAddQuantityIntentHandler = require('./ProvideAddQuantityIntentHandler');
const ProvideDeleteQuantityIntentHandler = require('./ProvideDeleteQuantityIntentHandler');
const SelectDeliverySlotIntentHandler = require('./SelectDeliverySlotIntentHandler');
const SelectPromotionIntentHandler = require('./SelectPromotionIntentHandler');
const AddCartIntentHandler = require('./AddCartIntentHandler');
const SelectDeliveryAddressIntentHandler = require('./SelectDeliveryAddressIntentHandler');
const SelectPaymentMethodIntentHandler = require('./SelectPaymentMethodIntentHandler');
const SpecifyWaonPointsIntentHandler = require('./SpecifyWaonPointsIntentHandler');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    const intentName = Alexa.getIntentName(request);
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes() || {};

    // Only handle when user uttered NumberOnlyIntent
    if (!(Alexa.getRequestType(request) === 'IntentRequest' && intentName === 'NumberOnlyIntent')) {
      return false;
    }

    // We only want to intercept pure-number replies when there is context (lastAction)
    if (!sessionAttributes.lastAction) return false;

    // Accept if lastAction is one of the follow-up actions we support
    const followUps = [
      'SearchProductIntent',
      'AddCartIntent',
      'DeleteCartIntent',
      'SearchAvailableDeliverySlotIntent',
      'SearchAvailablePromotionIntent',
      'SearchAvailableDeliveryAddressIntent',
      // payment-related
      'StartPaymentIntent',
      'SelectPaymentMethodIntent',
      'SpecifyWaonPointsIntent'
    ];
    return followUps.includes(sessionAttributes.lastAction);
  },

  async handle(handlerInput) {
    const requestEnvelope = handlerInput.requestEnvelope;
    const intent = requestEnvelope.request.intent || { slots: {} };
    const slots = intent.slots || {};
    const numberValue = slots.Number && (slots.Number.value || (slots.Number.resolutions && slots.Number.resolutions.resolutionsPerAuthority && slots.Number.resolutions.resolutionsPerAuthority[0] && slots.Number.resolutions.resolutionsPerAuthority[0].values && slots.Number.resolutions.resolutionsPerAuthority[0].values[0] && slots.Number.resolutions.resolutionsPerAuthority[0].values[0].value && slots.Number.resolutions.resolutionsPerAuthority[0].values[0].value.name));

    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes() || {};

    // Build a fake handlerInput for the target handler by cloning and replacing intent name/slots as needed
    const cloneRequestEnvelope = JSON.parse(JSON.stringify(requestEnvelope));

    const lastAction = sessionAttributes.lastAction;

    try {
      if (lastAction === 'SearchProductIntent') {
        // User just saw search results and said a number: treat as selecting an item number
        cloneRequestEnvelope.request.intent.name = 'AddCartIntent';
        cloneRequestEnvelope.request.intent.slots = { ItemNumber: { name: 'ItemNumber', value: numberValue } };
        const fakeHandlerInput = Object.assign({}, handlerInput, { requestEnvelope: cloneRequestEnvelope });
        return await AddCartIntentHandler.handle(fakeHandlerInput);
      }
      if (lastAction === 'AddCartIntent') {
        // Route to ProvideAddQuantityIntentHandler: map Number -> Quantity
        cloneRequestEnvelope.request.intent.name = 'ProvideAddQuantityIntent';
        cloneRequestEnvelope.request.intent.slots = { Quantity: { name: 'Quantity', value: numberValue } };
        const fakeHandlerInput = Object.assign({}, handlerInput, { requestEnvelope: cloneRequestEnvelope });
        return await ProvideAddQuantityIntentHandler.handle(fakeHandlerInput);
      }

      if (lastAction === 'DeleteCartIntent') {
        // Route to ProvideDeleteQuantityIntentHandler: map Number -> Quantity
        cloneRequestEnvelope.request.intent.name = 'ProvideDeleteQuantityIntent';
        cloneRequestEnvelope.request.intent.slots = { Quantity: { name: 'Quantity', value: numberValue } };
        const fakeHandlerInput = Object.assign({}, handlerInput, { requestEnvelope: cloneRequestEnvelope });
        return await ProvideDeleteQuantityIntentHandler.handle(fakeHandlerInput);
      }

      if (lastAction === 'SearchAvailableDeliverySlotIntent') {
        // Route to SelectDeliverySlotIntentHandler: map Number -> SlotNumber
        cloneRequestEnvelope.request.intent.name = 'SelectDeliverySlotIntent';
        cloneRequestEnvelope.request.intent.slots = { SlotNumber: { name: 'SlotNumber', value: numberValue } };
        const fakeHandlerInput = Object.assign({}, handlerInput, { requestEnvelope: cloneRequestEnvelope });
        return await SelectDeliverySlotIntentHandler.handle(fakeHandlerInput);
      }

      if (lastAction === 'SearchAvailablePromotionIntent') {
        // Route to SelectPromotionIntentHandler: map Number -> PromoNumber
        cloneRequestEnvelope.request.intent.name = 'SelectPromotionIntent';
        cloneRequestEnvelope.request.intent.slots = { PromoNumber: { name: 'PromoNumber', value: numberValue } };
        const fakeHandlerInput = Object.assign({}, handlerInput, { requestEnvelope: cloneRequestEnvelope });
        return await SelectPromotionIntentHandler.handle(fakeHandlerInput);
      }

      if (lastAction === 'SearchAvailableDeliveryAddressIntent') {
        // Route to SelectDeliveryAddressIntentHandler: map Number -> AddressNumber
        cloneRequestEnvelope.request.intent.name = 'SelectDeliveryAddressIntent';
        cloneRequestEnvelope.request.intent.slots = { AddressNumber: { name: 'AddressNumber', value: numberValue } };
        const fakeHandlerInput = Object.assign({}, handlerInput, { requestEnvelope: cloneRequestEnvelope });
        return await SelectDeliveryAddressIntentHandler.handle(fakeHandlerInput);
      }

      // Payment-related numeric routing
      if (lastAction === 'StartPaymentIntent') {
        // Number corresponds to payment method selection
        cloneRequestEnvelope.request.intent.name = 'SelectPaymentMethodIntent';
        cloneRequestEnvelope.request.intent.slots = { PaymentNumber: { name: 'PaymentNumber', value: numberValue } };
        const fakeHandlerInput = Object.assign({}, handlerInput, { requestEnvelope: cloneRequestEnvelope });
        return await SelectPaymentMethodIntentHandler.handle(fakeHandlerInput);
      }

      if (lastAction === 'SpecifyWaonPointsIntent' || lastAction === 'SelectPaymentMethodIntent') {
        // Map number -> points
        cloneRequestEnvelope.request.intent.name = 'SpecifyWaonPointsIntent';
        cloneRequestEnvelope.request.intent.slots = { Points: { name: 'Points', value: numberValue } };
        const fakeHandlerInput = Object.assign({}, handlerInput, { requestEnvelope: cloneRequestEnvelope });
        return await SpecifyWaonPointsIntentHandler.handle(fakeHandlerInput);
      }

      // Fallback: let the IntentReflector or normal chain handle it
      const speak = '申し訳ありません。何の番号か分かりませんでした。もう一度言ってください。';
      return handlerInput.responseBuilder.speak(speak).reprompt(speak).getResponse();
    } catch (err) {
      console.log('[NumberOnlyIntentHandler] error routing:', err);
      const speak = '処理中にエラーが発生しました。もう一度お願いいたします。';
      return handlerInput.responseBuilder.speak(speak).reprompt(speak).getResponse();
    }
  }
};
