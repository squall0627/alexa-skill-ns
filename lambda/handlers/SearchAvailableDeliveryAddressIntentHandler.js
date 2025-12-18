// 届け先一覧検索ハンドラ（SearchAvailableDeliveryAddressIntentHandler）
// 利用可能な届け先を検索してユーザーに提示するハンドラ
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

      // 届け先を読み込む
      const addresses = await DeliveryAddressService.listAddresses();

      if (!addresses || addresses.length === 0) {
        const speak = '申し訳ありません。登録された届け先が見つかりませんでした。新しい届け先を追加しますか？';
        // Yes/No を処理するために pending を設定
        sessionAttributes.pending = true;
        sessionAttributes.pendingData = { kind: 'addNewAddress' };
        sessionAttributes.lastAction = 'SearchAvailableDeliveryAddressIntent';
        attributesManager.setSessionAttributes(sessionAttributes);
        const { attachSpeechAndCard, buildGenericCard } = require('../utils/responseUtils');
        const card = buildGenericCard('届け先が見つかりません', speak);
        const rb = attachSpeechAndCard(handlerInput.responseBuilder, speak, '届け先が見つかりません', card);
        return rb.reprompt('新しい届け先を追加しますか？ はい／いいえ でお答えください。').getResponse();
      }

      // 選択用にセッションへ住所一覧を保存
      sessionAttributes.availableDeliveryAddresses = addresses;
      sessionAttributes.lastAction = 'SearchAvailableDeliveryAddressIntent';

      if (addresses.length === 1) {
        // 単一の既定の住所を使用するか確認する
        sessionAttributes.pending = true;
        sessionAttributes.pendingData = { kind: 'confirmDefaultAddress', addressIndex: 1 };
        attributesManager.setSessionAttributes(sessionAttributes);
        const addr = addresses[0];
        const speak = `現在の届け先は ${addr.spokenLabel} です。こちらを使いますか？`;
        // SSML 表示があれば優先
        const ssmlBody = addr.spokenLabelSSML ? String(addr.spokenLabelSSML).replace(/^<speak>\s*/i, '').replace(/\s*<\/speak>$/i, '') : null;
        const fullSSML = ssmlBody ? `<speak>現在の届け先は ${ssmlBody} です。こちらを使いますか？</speak>` : null;
        const { buildAddressCard, attachSpeechAndCard } = require('../utils/responseUtils');
        const card = buildAddressCard(addr);
        const rb = attachSpeechAndCard(handlerInput.responseBuilder, fullSSML || speak, '届け先の確認', card);
        return rb.reprompt('この届け先を使いますか？ はい/いいえ でお答えください。').getResponse();
      }

      // 番号付き一覧の発話を作成（簡潔に）
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
