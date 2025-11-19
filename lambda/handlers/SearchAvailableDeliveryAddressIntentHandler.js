// ...existing code...
// lambda/handlers/SearchAvailableDeliveryAddressIntentHandler.js
const Alexa = require('ask-sdk-core');
const DeliveryAddressService = require('../services/DeliveryAddressService');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'SearchAvailableDeliveryAddressIntent';
  },

  async handle(handlerInput) {
    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes() || {};

    // Load addresses
    const addresses = await DeliveryAddressService.listAddresses();

    if (!addresses || addresses.length === 0) {
      const speak = '申し訳ありません。登録された配送先が見つかりませんでした。新しい配送先を追加しますか？';
      // set pending to handle yes/no
      sessionAttributes.pending = true;
      sessionAttributes.pendingData = { kind: 'addNewAddress' };
      sessionAttributes.lastAction = 'SearchAvailableDeliveryAddressIntent';
      attributesManager.setSessionAttributes(sessionAttributes);
      return handlerInput.responseBuilder.speak(speak).reprompt('新しい配送先を追加しますか？ はい／いいえ でお答えください。').getResponse();
    }

    // Save addresses to session for selection later
    sessionAttributes.availableDeliveryAddresses = addresses;
    sessionAttributes.lastAction = 'SearchAvailableDeliveryAddressIntent';

    if (addresses.length === 1) {
      // Confirm using the single/default address
      sessionAttributes.pending = true;
      sessionAttributes.pendingData = { kind: 'confirmDefaultAddress', addressIndex: 1 };
      attributesManager.setSessionAttributes(sessionAttributes);
      const speak = `現在の配送先は ${addresses[0].spokenLabel} です。こちらを使いますか？`;
      return handlerInput.responseBuilder.speak(speak).reprompt('この配送先を使いますか？ はい/いいえ でお答えください。').getResponse();
    }

    // Build numbered list speech (keep it concise)
    const parts = addresses.map((a, idx) => `${idx + 1}番: ${a.spokenLabel}`);
    const speak = `以下から配送先を選択してください。${parts.join('、')}。どの番号にしますか？`;
    attributesManager.setSessionAttributes(sessionAttributes);
    return handlerInput.responseBuilder.speak(speak).reprompt('番号で教えてください。例えば、1番。').getResponse();
  }
};

// ...existing code...
