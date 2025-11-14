// lambda/handlers/SelectDeliverySlotIntentHandler.js
// This is the renamed version of the former ChooseDeliverySlotIntentHandler, now named SelectDeliverySlotIntentHandler
const Alexa = require('ask-sdk-core');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    const intentName = Alexa.getIntentName(request);
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes() || {};
    return Alexa.getRequestType(request) === 'IntentRequest' && intentName === 'SelectDeliverySlotIntent' && sessionAttributes.lastAction === 'SearchAvailableDeliverySlotIntent';
  },
  async handle(handlerInput) {
    const requestEnvelope = handlerInput.requestEnvelope;
    const intent = requestEnvelope.request.intent || { slots: {} };
    const slots = intent.slots || {};
    const slotNumberValue = slots.SlotNumber && (slots.SlotNumber.value || (slots.SlotNumber.resolutions && slots.SlotNumber.resolutions.resolutionsPerAuthority && slots.SlotNumber.resolutions.resolutionsPerAuthority[0] && slots.SlotNumber.resolutions.resolutionsPerAuthority[0].values && slots.SlotNumber.resolutions.resolutionsPerAuthority[0].values[0] && slots.SlotNumber.resolutions.resolutionsPerAuthority[0].values[0].value.name));

    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes() || {};

    const available = sessionAttributes.availableDeliverySlots || [];

    if (!available || available.length === 0) {
      const speak = '申し訳ありません。利用可能な配送枠の候補が見つかりません。もう一度配達枠を表示しますか？';
      return handlerInput.responseBuilder.speak(speak).reprompt('配達枠を表示しますか？').getResponse();
    }

    const index = slotNumberValue ? parseInt(slotNumberValue, 10) : NaN;
    if (Number.isNaN(index) || index < 1 || index > available.length) {
      const speak = `申し訳ありません。番号は1から${available.length}の間で教えてください。どの枠を選びますか？`;
      return handlerInput.responseBuilder.speak(speak).reprompt('番号で教えてください。').getResponse();
    }

    const selected = available[index - 1];

    sessionAttributes.cart = sessionAttributes.cart || [];
    sessionAttributes.cartDelivery = selected;

    delete sessionAttributes.availableDeliverySlots;
    sessionAttributes._cartDirty = true;
    attributesManager.setSessionAttributes(sessionAttributes);

    const speak = `配送枠を選択しました。${selected.spokenLabel} を選択しました。お支払いに進みますか、それとも他に追加しますか？`;
    return handlerInput.responseBuilder.speak(speak).reprompt('お支払いに進みますか？').getResponse();
  }
};

