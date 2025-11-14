// lambda/handlers/ViewCartIntentHandler.js
// 日本語：カート内の商品を順番に読み上げるハンドラ
const Alexa = require('ask-sdk-core');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'ViewCartIntent';
  },
  handle(handlerInput) {
    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes() || {};
    const cart = sessionAttributes.cart || [];

    if (!cart || cart.length === 0) {
      const speak = 'カートに商品が入っていません。商品を追加できます。何を購入しますか？';
      return handlerInput.responseBuilder.speak(speak).reprompt('何を購入しますか？').getResponse();
    }

    // 按照加入順（cart 数组顺序）从头到尾读出信息，并计算合计
    let totalPrice = 0;
    const parts = cart.map((item, idx) => {
      const num = idx + 1;
      const name = item.name || '商品';
      const qty = item.quantity || 1;
      const unitPrice = (item.promoPrice && item.promoPrice < item.price) ? item.promoPrice : item.price;
      const lineTotal = (unitPrice || 0) * qty;
      totalPrice += lineTotal;
      const promoText = (item.promoPrice && item.promoPrice < item.price) ? `現在セール中、特別価格は${item.promoPrice}円です` : '';
      return `番号${num}、${name}、${qty}個、単価は${unitPrice}円。${promoText}`.trim();
    });

    // 明示：合計には配送料やクーポンは含まれない
    const spoken = `カートの中身をお知らせします。${parts.join('。 ')}。合計で${cart.length}種類の商品が入っています。合計金額は${totalPrice}円です（配送料・クーポンは含みません）。`;
    return handlerInput.responseBuilder.speak(spoken).reprompt('続けて注文しますか？').getResponse();
  }
};
