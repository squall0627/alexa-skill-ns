// lambda/handlers/SearchAvailableDeliveryAddressIntentHandler.js
const Alexa = require('ask-sdk-core');
const DeliveryAddressService = require('../services/DeliveryAddressService');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'SearchAvailableDeliveryAddressIntent';
  },

  async handle(handlerInput) {
    console.log('Start handling SearchAvailableDeliveryAddressIntentHandler');
    try {
      const attributesManager = handlerInput.attributesManager;
      const sessionAttributes = attributesManager.getSessionAttributes() || {};

      // Load addresses
      const addresses = await DeliveryAddressService.listAddresses();

      if (!addresses || addresses.length === 0) {
        const speak = '申し訳ありません。登録された届け先が見つかりませんでした。新しい届け先を追加しますか？';
        // set pending to handle yes/no
        sessionAttributes.pending = true;
        sessionAttributes.pendingData = { kind: 'addNewAddress' };
        sessionAttributes.lastAction = 'SearchAvailableDeliveryAddressIntent';
        attributesManager.setSessionAttributes(sessionAttributes);
        const { attachSpeechAndCard, buildGenericCard } = require('../utils/responseUtils');
        const card = buildGenericCard('届け先が見つかりません', speak);
        const rb = attachSpeechAndCard(handlerInput.responseBuilder, speak, '届け先が見つかりません', card);
        return rb.reprompt('新しい届け先を追加しますか？ はい／いいえ でお答えください。').getResponse();
      }

      // Save addresses to session for selection later
      sessionAttributes.availableDeliveryAddresses = addresses;
      sessionAttributes.lastAction = 'SearchAvailableDeliveryAddressIntent';

      if (addresses.length === 1) {
        // Confirm using the single/default address
        sessionAttributes.pending = true;
        sessionAttributes.pendingData = { kind: 'confirmDefaultAddress', addressIndex: 1 };
        attributesManager.setSessionAttributes(sessionAttributes);
        const addr = addresses[0];
        const speak = `現在の届け先は ${addr.spokenLabel} です。こちらを使いますか？`;
        // prefer SSML label if available
        const ssmlBody = addr.spokenLabelSSML ? String(addr.spokenLabelSSML).replace(/^<speak>\s*/i, '').replace(/\s*<\/speak>$/i, '') : null;
        const fullSSML = ssmlBody ? `<speak>現在の届け先は ${ssmlBody} です。こちらを使いますか？</speak>` : null;
        const { buildAddressCard, attachSpeechAndCard } = require('../utils/responseUtils');
        const card = buildAddressCard(addr);
        const rb = attachSpeechAndCard(handlerInput.responseBuilder, fullSSML || speak, '届け先の確認', card);
        return rb.reprompt('この届け先を使いますか？ はい/いいえ でお答えください。').getResponse();
      }

      // Build numbered list speech (keep it concise)
      const parts = addresses.map((a, idx) => `${idx + 1}番: ${a.spokenLabel}`);
      const speak = `以下から届け先を選択してください。${parts.join('、')}。どの番号にしますか？`;
      attributesManager.setSessionAttributes(sessionAttributes);
      const { buildGenericCard, attachSpeechAndCard } = require('../utils/responseUtils');
      const cardBody = buildGenericCard('利用可能な届け先', addresses.map((a, i) => `${i + 1}. ${a.spokenLabel}`).join('\n'));
      const rb = attachSpeechAndCard(handlerInput.responseBuilder, speak, '利用可能な届け先', cardBody);
      return rb.reprompt('番号で教えてください。例えば、1番。').getResponse();
    } finally {
      console.log('End handling SearchAvailableDeliveryAddressIntentHandler');
    }
  }
};
