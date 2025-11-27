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
        const speak = '申し訳ありません。先に届け先を検索してください。どの届け先にしますか？';
        return handlerInput.responseBuilder.speak(speak).reprompt('届け先を選択するには、利用可能な届け先を検索してから番号でお答えください。').getResponse();
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
      // Ask whether to check available promotions next (set pending to be handled by PendingConfirmationHandler)
      sessionAttributes.pending = true;
      sessionAttributes.pendingData = { kind: 'confirmCheckPromotions', addressIndex: idx };
      // persist updated session
      attributesManager.setSessionAttributes(sessionAttributes);

      const speak = `届け先を選択しました。${selected.spokenLabel} を届け先として設定しました。利用可能なクーポンを確認しますか？ はいで確認します、いいえでお支払いに進みます。`;
      const reprompt = '利用可能なクーポンを確認しますか？ はい、またはいいえでお答えください。';

      // Prefer SSML if service provided it, otherwise fallback to plain text
      const ssmlBody = selected.spokenLabelSSML ? String(selected.spokenLabelSSML).replace(/^<speak>\s*/i, '').replace(/\s*<\/speak>$/i, '') : null;
      const fullSSML = ssmlBody ? `<speak>届け先を選択しました。${ssmlBody} を届け先として設定しました。利用可能なクーポンを確認しますか？ はいで確認します、いいえでお支払いに進みます。</speak>` : null;

      const rb = fullSSML ? handlerInput.responseBuilder.speak(fullSSML).reprompt(reprompt) : handlerInput.responseBuilder.speak(speak).reprompt(reprompt);
      if (typeof rb.withSimpleCard === 'function') {
        rb.withSimpleCard('届け先を選択しました', selected.spokenLabel || '届け先を選択しました');
      }
      return rb.getResponse();
    } finally {
      console.log('End handling SelectDeliveryAddressIntentHandler');
    }
  }
};
