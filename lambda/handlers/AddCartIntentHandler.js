// handlers/AddCartIntentHandler.js
// 日本語：AddCartIntent ハンドラ - ユーザーが番号で指定した商品をセッションのカートに追加する
const Alexa = require('ask-sdk-core');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'AddCartIntent';
  },
  handle(handlerInput) {
    const requestEnvelope = handlerInput.requestEnvelope;
    const sessionId = requestEnvelope.session ? requestEnvelope.session.sessionId : 'unknown';
    const intent = requestEnvelope.request.intent || { slots: {} };
    const slots = intent.slots || {};

    const attributesManager = handlerInput.attributesManager;
    let sessionAttributes = attributesManager.getSessionAttributes() || {};
    const { markLastAction } = require('../utils/sessionUtils');
    // mark this handler as the last action (intent name)
    markLastAction(handlerInput, 'AddCartIntent');

    console.log(`[AddCartIntent] Handler started for session: ${sessionId}`);
    console.log(`[AddCartIntent] Current sessionAttributes keys:`, Object.keys(sessionAttributes));
    console.log(`[AddCartIntent] lastSearchResults available:`, !!sessionAttributes.lastSearchResults);

    // lastSearchResults に直近の検索結果（配列）を保持している想定
    const lastResults = sessionAttributes.lastSearchResults || [];

    // スロット名: ItemNumber
    const itemNumberSlot = slots.ItemNumber && (slots.ItemNumber.value || (slots.ItemNumber.resolutions && slots.ItemNumber.resolutions.resolutionsPerAuthority && slots.ItemNumber.resolutions.resolutionsPerAuthority[0] && slots.ItemNumber.resolutions.resolutionsPerAuthority[0].values && slots.ItemNumber.resolutions.resolutionsPerAuthority[0].values[0] && slots.ItemNumber.resolutions.resolutionsPerAuthority[0].values[0].value && slots.ItemNumber.resolutions.resolutionsPerAuthority[0].values[0].value.name));
    const rawNumber = itemNumberSlot || (slots.ItemNumber && slots.ItemNumber.value);
    const index = rawNumber ? parseInt(rawNumber, 10) : NaN;

    // スロット: Quantity（口語的表現にも寛容に対応）
    const parseQuantity = require('../utils/parseQuantity').parseSpokenQuantity;
    const rawQty = (slots.Quantity && (slots.Quantity.value || (slots.Quantity.resolutions && slots.Quantity.resolutions.resolutionsPerAuthority && slots.Quantity.resolutions.resolutionsPerAuthority[0] && slots.Quantity.resolutions.resolutionsPerAuthority[0].values && slots.Quantity.resolutions.resolutionsPerAuthority[0].values[0] && slots.Quantity.resolutions.resolutionsPerAuthority[0].values[0].value && slots.Quantity.resolutions.resolutionsPerAuthority[0].values[0].value.name))) || (slots.Quantity && slots.Quantity.value);
    const quantity = parseQuantity(rawQty);

    console.log(`[AddCartIntent] Parsed ItemNumber slot: value=${rawNumber}, index=${index}, Quantity=${rawQty}`);

    // ユーザーフレンドリーな応答（日本語）
    if (!lastResults || lastResults.length === 0) {
      const speak = '現在カートに追加できる検索結果がありません。商品を検索して、表示された番号を教えてください。';
      console.log(`[AddCartIntent] No lastSearchResults available, returning error message`);
      return handlerInput.responseBuilder.speak(speak).reprompt('どの商品をお探しですか？').getResponse();
    }

    if (Number.isNaN(index) || index < 1 || index > lastResults.length) {
      const speak = `申し訳ありません。番号は1から${lastResults.length}の間で教えてください。もう一度番号を教えてください。`;
      console.log(`[AddCartIntent] Invalid index: ${index}, max: ${lastResults.length}`);
      return handlerInput.responseBuilder.speak(speak).reprompt(`1から${lastResults.length}の番号で教えてください。`).getResponse();
    }

    const product = lastResults[index - 1];
    console.log(`[AddCartIntent] Selected product:`, { id: product.id, name: product.name });

    // 如果用户提供了数量，则直接加入购物车
    if (!Number.isNaN(quantity) && quantity >= 1) {
      const cart = sessionAttributes.cart || [];
      const cartUtils = require('../utils/cartUtils');
      const { cart: newCart, item, totalQuantity } = cartUtils.addOrMergeCartItem(cart, product, quantity);
      sessionAttributes.cart = newCart;
      sessionAttributes.lastAdded = item;
      sessionAttributes._cartDirty = true;

      attributesManager.setSessionAttributes(sessionAttributes);
      console.log(`[AddCartIntent] Session attributes updated:`, { cartSize: newCart.length, lastAction: sessionAttributes.lastAction });

      const shortInfo = `${product.name}、メーカー：${product.brand}、価格：${product.price}円`;
      const speak = `${shortInfo} を ${quantity} 個追加しました。合計で ${totalQuantity} 個になりました。現在カートには ${newCart.length} 件の商品があります。続けて別の商品を検索しますか？`;
      const reprompt = '続けて検索しますか？はいで続ける、いいえでカートを確認します。';
      return handlerInput.responseBuilder.speak(speak).reprompt(reprompt).getResponse();
    }

    // 用户没有提供数量：保存 pendingAdd 并向用户询问数量
    // save a generic pending flag + data; lastAction already set to 'AddCartIntent'
    sessionAttributes.pending = true;
    sessionAttributes.pendingData = { kind: 'addQuantity', index: index, product: product };
    attributesManager.setSessionAttributes(sessionAttributes);

    const speak = `${product.name} を何個カートに入れますか？`;
    const reprompt = '個数を教えてください。例えば、2個、3個のようにお答えください。';
    return handlerInput.responseBuilder.speak(speak).reprompt(reprompt).getResponse();
  }
};
