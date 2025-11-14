// lambda/handlers/ProvideAddQuantityIntentHandler.js
// 日本語：ユーザーが数量を応答したときに pendingAdd を完成させるハンドラ
const Alexa = require('ask-sdk-core');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    const sessionAttributes = handlerInput.attributesManager && handlerInput.attributesManager.getSessionAttributes ? handlerInput.attributesManager.getSessionAttributes() || {} : {};
    // Only handle ProvideQuantity when a generic pending flag is set and the lastAction was AddCartIntent
    if (!sessionAttributes.pending || sessionAttributes.lastAction !== 'AddCartIntent') {
      return false;
    }
    // also ensure the pendingData kind matches addQuantity
    const pendingData = sessionAttributes.pendingData || {};
    if (pendingData.kind !== 'addQuantity') return false;
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'ProvideQuantityIntent';
  },
  handle(handlerInput) {
    const requestEnvelope = handlerInput.requestEnvelope;
    const intent = requestEnvelope.request.intent || { slots: {} };
    const slots = intent.slots || {};

    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes() || {};

    // pending data is stored in pendingData with kind 'addQuantity'
    const pendingData = sessionAttributes.pendingData;
    if (!pendingData || pendingData.kind !== 'addQuantity' || !pendingData.product) {
      const speak = 'どの商品についての個数か分かりませんでした。追加したい商品を番号で教えてください。';
      return handlerInput.responseBuilder.speak(speak).reprompt('どの商品をカートに入れますか？').getResponse();
    }

    // 解析数量槽（寛容）
    const parseQuantity = require('../utils/parseQuantity').parseSpokenQuantity;
    const quantitySlot = slots.Quantity && (slots.Quantity.value || (slots.Quantity.resolutions && slots.Quantity.resolutions.resolutionsPerAuthority && slots.Quantity.resolutions.resolutionsPerAuthority[0] && slots.Quantity.resolutions.resolutionsPerAuthority[0].values && slots.Quantity.resolutions.resolutionsPerAuthority[0].values[0] && slots.Quantity.resolutions.resolutionsPerAuthority[0].values[0].value && slots.Quantity.resolutions.resolutionsPerAuthority[0].values[0].value.name));
    const rawQty = quantitySlot || (slots.Quantity && slots.Quantity.value);
    const quantity = parseQuantity(rawQty);

    if (Number.isNaN(quantity) || quantity < 1) {
      const speak = '申し訳ありません。個数がわかりませんでした。何個入れますか？';
      return handlerInput.responseBuilder.speak(speak).reprompt('個数を教えてください。').getResponse();
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
    const speak = `${shortInfo} を ${quantity} 個追加しました。合計で ${totalQuantity} 個になりました。現在カートには ${newCart.length} 件の商品があります。続けて別の商品を検索しますか？`;
    const reprompt = '続けて検索しますか？はいで続ける、いいえでカートを確認します。';
    return handlerInput.responseBuilder.speak(speak).reprompt(reprompt).getResponse();
  }
};
