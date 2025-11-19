// lambda/handlers/SelectDeliveryAddressIntentHandler.js
const Alexa = require('ask-sdk-core')

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    if (Alexa.getRequestType(request) !== 'IntentRequest') return false;
    const intentName = Alexa.getIntentName(request);
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes() || {};
    return intentName === 'SelectDeliveryAddressIntent' && sessionAttributes.lastAction === 'SearchAvailableDeliveryAddressIntent';
  },

  async handle(handlerInput) {
    console.log('Start handling SelectDeliveryAddressIntentHandler');
    try {
      const requestEnvelope = handlerInput.requestEnvelope;
      const intent = requestEnvelope.request.intent || { slots: {} };
      const slots = intent.slots || {};
      const numberValue = slots.AddressNumber && (slots.AddressNumber.value || (slots.AddressNumber.resolutions && slots.AddressNumber.resolutions.resolutionsPerAuthority && slots.AddressNumber.resolutions.resolutionsPerAuthority[0] && slots.AddressNumber.resolutions.resolutionsPerAuthority[0].values && slots.AddressNumber.resolutions.resolutionsPerAuthority[0].values[0] && slots.AddressNumber.resolutions.resolutionsPerAuthority[0].values[0].value && slots.AddressNumber.resolutions.resolutionsPerAuthority[0].values[0].value.name));

      const attributesManager = handlerInput.attributesManager;
      const sessionAttributes = attributesManager.getSessionAttributes() || {};

      // Validate available addresses exist
      const available = sessionAttributes.availableDeliveryAddresses || [];
      if (!Array.isArray(available) || available.length === 0) {
        const speak = '申し訳ありません。先に配送先を表示してください。どの配送先にしますか？';
        return handlerInput.responseBuilder.speak(speak).reprompt('配送先を選択するには、一覧を表示してから番号でお答えください。').getResponse();
      }

      const idx = Number(numberValue);
      if (!Number.isInteger(idx) || idx < 1 || idx > available.length) {
        const speak = `申し訳ありません。番号は1から${available.length}の間で教えてください。もう一度番号を教えてください。`;
        return handlerInput.responseBuilder.speak(speak).reprompt(`番号は1から${available.length}の間で教えてください。`).getResponse();
      }

      const selected = available[idx - 1];
      // Save selected address into session as cartDeliveryAddress
      sessionAttributes.cartDeliveryAddress = selected;
      // Clear temporary list
      delete sessionAttributes.availableDeliveryAddresses;
      sessionAttributes._cartDirty = true;
      attributesManager.setSessionAttributes(sessionAttributes);

      const speak = `配送先を選択しました。${selected.spokenLabel} を配送先として設定しました。お支払いに進みますか？`;
      return handlerInput.responseBuilder.speak(speak).reprompt('お支払いに進みますか？').getResponse();
    } finally {
      console.log('End handling SelectDeliveryAddressIntentHandler');
    }
  }
};
