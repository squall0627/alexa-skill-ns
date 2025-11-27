// lambda/handlers/ViewCartIntentHandler.js
// 日本語：カート内の商品を順番に読み上げるハンドラ
const Alexa = require('ask-sdk-core');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'ViewCartIntent';
  },
  handle(handlerInput) {
    console.log('Start handling ViewCartIntentHandler');
    try {
      const attributesManager = handlerInput.attributesManager;
      const sessionAttributes = attributesManager.getSessionAttributes() || {};
      // mark last action as this intent via helper
      const { markLastAction } = require('../utils/sessionUtils');
      const { buildCartCard, attachSpeechAndCard } = require('../utils/responseUtils');
      markLastAction(handlerInput, 'ViewCartIntent');
      const cart = sessionAttributes.cart || [];

      if (!cart || cart.length === 0) {
        const speak = 'カートに商品が入っていません。商品を追加できます。何を購入しますか？';
        const card = buildCartCard(cart);
        const rb = attachSpeechAndCard(handlerInput.responseBuilder, speak, 'カートの中身', card);
        return rb.reprompt('何を購入しますか？').getResponse();
      }

      // 按照加入顺（cart 数组顺序）从头到尾读出信息，并计算合计
      let totalPrice = 0;
      const parts = cart.map((item, idx) => {
        const num = idx + 1;
        const name = item.name || '商品';
        const qty = item.quantity || 1;
        const unitPrice = (item.promoPrice && item.promoPrice < item.price) ? item.promoPrice : item.price;
        const safeUnit = unitPrice || 0;
        const lineTotal = safeUnit * qty;
        totalPrice += lineTotal;
        const promoText = (item.promoPrice && item.promoPrice < item.price)
          ? `現在セール中、特別価格は<say-as interpret-as="cardinal">${item.promoPrice}</say-as>円です`
          : '';
        // Wrap numeric pieces in say-as interpret-as="cardinal" so Alexa reads e.g. 100 as "百"
        return `番号<say-as interpret-as="cardinal">${num}</say-as>、${name}、<say-as interpret-as="cardinal">${qty}</say-as>個、単価は<say-as interpret-as="cardinal">${safeUnit}</say-as>円。${promoText}`.trim();
      });

      // 明示：合計には配送料やクーポンは含まれない
      const spoken = `<speak>カートの中身をお知らせします。${parts.join('。 ')}。合計で<say-as interpret-as="cardinal">${cart.length}</say-as>種類の商品が入っています。合計金額は<say-as interpret-as="cardinal">${totalPrice}</say-as>円です（配送料・クーポンは含みません）。</speak>`;
      const card = buildCartCard(cart);
      const rb = attachSpeechAndCard(handlerInput.responseBuilder, spoken, 'カートの中身', card);
      return rb.reprompt('続けて注文しますか？').getResponse();
    } finally {
      console.log('End handling ViewCartIntentHandler');
    }
  }
};
