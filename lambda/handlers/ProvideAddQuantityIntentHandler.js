// 個数提供ハンドラ（ProvideAddQuantityIntentHandler）
// ユーザーが数量を応答したときに pendingAdd を完成させるハンドラ
const Alexa = require('ask-sdk-core');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes() || {};
    // ProvideQuantity を処理するのは、汎用の pending フラグが立っており、かつ lastAction が AddCartIntent の場合のみ
    if (!sessionAttributes.pending || sessionAttributes.lastAction !== 'AddCartIntent') {
      return false;
    }
    // pendingData の kind が addQuantity であることも確認
    const pendingData = sessionAttributes.pendingData || {};
    if (pendingData.kind !== 'addQuantity') return false;
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'ProvideAddQuantityIntent';
  },
  handle(handlerInput) {
    console.log('Start handling ProvideAddQuantityIntentHandler');
    try {
      const requestEnvelope = handlerInput.requestEnvelope;
      const intent = requestEnvelope.request.intent || { slots: {} };
      const slots = intent.slots || {};

      const attributesManager = handlerInput.attributesManager;
      const sessionAttributes = attributesManager.getSessionAttributes() || {};

      // pending data is stored in pendingData with kind 'addQuantity'
      const pendingData = sessionAttributes.pendingData;
      if (!pendingData || pendingData.kind !== 'addQuantity' || !pendingData.product) {
        const speak = 'どの商品についての個数か分かりませんでした。追加したい商品を番号で教えてください。';
        const { attachSpeechAndCard, buildGenericCard } = require('../utils/responseUtils');
        const card = buildGenericCard('個数対象が不明', speak);
        const rb = attachSpeechAndCard(handlerInput.responseBuilder, speak, '個数対象が不明', card);
        return rb.reprompt('どの商品をカートに入れますか？').getResponse();
      }

      // 解析数量槽（寛容）
      const parseQuantity = require('../utils/parseQuantity').parseSpokenQuantity;
      const quantitySlot = slots.Quantity && (slots.Quantity.value || (slots.Quantity.resolutions && slots.Quantity.resolutions.resolutionsPerAuthority && slots.Quantity.resolutions.resolutionsPerAuthority[0] && slots.Quantity.resolutions.resolutionsPerAuthority[0].values && slots.Quantity.resolutions.resolutionsPerAuthority[0].values[0] && slots.Quantity.resolutions.resolutionsPerAuthority[0].values[0].value && slots.Quantity.resolutions.resolutionsPerAuthority[0].values[0].value.name));
      const rawQty = quantitySlot || (slots.Quantity && slots.Quantity.value);
      const quantity = parseQuantity(rawQty);

      if (Number.isNaN(quantity) || quantity < 1) {
        const speak = '申し訳ありません。個数がわかりませんでした。何個入れますか？';
        const { attachSpeechAndCard, buildGenericCard } = require('../utils/responseUtils');
        const card = buildGenericCard('個数が不明です', speak);
        const rb = attachSpeechAndCard(handlerInput.responseBuilder, speak, '個数が不明です', card);
        return rb.reprompt('個数を教えてください。').getResponse();
      }

      const product = pendingData.product;
      const cart = sessionAttributes.cart || [];
      const cartUtils = require('../utils/cartUtils');
      const { cart: newCart, item, totalQuantity } = cartUtils.addOrMergeCartItem(cart, product, quantity);
      sessionAttributes.cart = newCart;
      sessionAttributes.lastAdded = item;
      sessionAttributes._cartDirty = true;

      // clear generic pending state
      delete sessionAttributes.pending;
      delete sessionAttributes.pendingData;
      attributesManager.setSessionAttributes(sessionAttributes);

      const shortInfo = `${product.name}、メーカー：${product.brand}、価格：${product.price}円`;
      const speak = `${shortInfo} を ${quantity} 個追加しました。合計で ${totalQuantity} 個になりました。現在カートには ${newCart.length} 件の商品があります。次にどうしますか？続けて別の商品を探す、カートを確認する、または配送便を選ぶことができます。カートを確認するなら「カートを見せて」、配送便を選ぶなら「配送時間を選んで」と言ってください。どれにしますか？`;
      const reprompt = '続けて買い物するなら商品名で探してください、カートを確認するなら「カートを見て」、配送の便を選ぶなら「配送時間を選んで」と言ってください。';

      const { buildGenericCard, attachSpeechAndCard } = require('../utils/responseUtils');
      const cardBody = buildGenericCard('カートに追加しました', `${shortInfo}\n数量: ${quantity}\n現在の合計個数: ${totalQuantity}\nカート内商品種類: ${newCart.length}`);
      const rb = attachSpeechAndCard(handlerInput.responseBuilder, speak, 'カートに追加しました', cardBody);
      return rb.reprompt(reprompt).getResponse();
    } finally {
      console.log('End handling ProvideAddQuantityIntentHandler');
    }
  }
};
