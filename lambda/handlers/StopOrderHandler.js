// 注文中止ハンドラ（StopOrderHandler）
// 日本語：今回の購入（オーダー）を中止し、関連する全ての注文情報を初期化するハンドラ
const Alexa = require('ask-sdk-core');
const orderUtils = require('../utils/orderUtils');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'StopOrderIntent';
  },
  async handle(handlerInput) {
    console.log('Start handling StopOrderHandler');
    try {
      const request = handlerInput.requestEnvelope;
      const attributesManager = handlerInput.attributesManager;

      // このインテントを最後のアクションとしてマーク
      const sessionAttributes = attributesManager.getSessionAttributes() || {};
      const { markLastAction } = require('../utils/sessionUtils');
      // ヘルパーを使って lastAction を設定
      markLastAction(handlerInput, 'StopOrderIntent');

      const intent = request.request.intent || {};
      const confirmationStatus = intent.confirmationStatus || 'NONE';

      const { attachSpeechAndCard, buildGenericCard } = require('../utils/responseUtils');

      if (confirmationStatus === 'CONFIRMED') {
        await orderUtils.stopOrder(attributesManager);
        const plain = '今回のご購入を中止しました。必要な場合はまた最初からご注文ください。';
        const ssml = `<speak>今回のご購入を中止しました。必要な場合はまた最初からご注文ください。</speak>`;
        const card = buildGenericCard('注文中止', plain);
        const rb = attachSpeechAndCard(handlerInput.responseBuilder, ssml, '注文中止', card);
        return rb.getResponse();
      }

      if (confirmationStatus === 'DENIED') {
        const plain = '注文中止をキャンセルしました。ほかに何をしますか？';
        const ssml = `<speak>注文中止をキャンセルしました。ほかに何をしますか？</speak>`;
        const card = buildGenericCard('注文継続', plain);
        const rb = attachSpeechAndCard(handlerInput.responseBuilder, ssml, '注文継続', card);
        return rb.reprompt('ほかに何をしますか？').getResponse();
      }

      // NONE の場合は pending を設定して確認を求める
      // 汎用の pending フラグを設定
      sessionAttributes.pending = true;
      sessionAttributes.pendingData = { kind: 'stopOrder' };
      attributesManager.setSessionAttributes(sessionAttributes);
      const plain = '今回のご購入を中止してもよろしいですか？';
      const reprompt = '今回の購入を中止してもよろしいですか？ はいで中止、いいえで継続します。';
      const ssml = `<speak>${plain}</speak>`;
      const card = buildGenericCard('注文中止の確認', plain);
      const rb = attachSpeechAndCard(handlerInput.responseBuilder, ssml, '注文中止の確認', card);
      return rb.reprompt(reprompt).getResponse();
    } finally {
      console.log('End handling StopOrderHandler');
    }
  }
};
