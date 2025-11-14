// lambda/handlers/DeleteCartIntentHandler.js
// 日本語：削除 Intent - カートから商品を削除または数量を減らす
const Alexa = require('ask-sdk-core');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'DeleteCartIntent';
  },
  handle(handlerInput) {
    const requestEnvelope = handlerInput.requestEnvelope;
    const intent = requestEnvelope.request.intent || { slots: {} };
    const slots = intent.slots || {};

    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes() || {};
    const { markLastAction } = require('../utils/sessionUtils');
    // mark last action as this intent
    markLastAction(handlerInput, 'DeleteCartIntent');

    const cart = sessionAttributes.cart || [];
    if (!cart || cart.length === 0) {
      const speak = 'カートに商品がありません。何を削除しますか？';
      return handlerInput.responseBuilder.speak(speak).reprompt('ほかに何をしますか？').getResponse();
    }

    // 解析 ItemNumber
    const itemNumberSlot = slots.ItemNumber && (slots.ItemNumber.value || (slots.ItemNumber.resolutions && slots.ItemNumber.resolutions.resolutionsPerAuthority && slots.ItemNumber.resolutions.resolutionsPerAuthority[0] && slots.ItemNumber.resolutions.resolutionsPerAuthority[0].values && slots.ItemNumber.resolutions.resolutionsPerAuthority[0].values[0] && slots.ItemNumber.resolutions.resolutionsPerAuthority[0].values[0].value && slots.ItemNumber.resolutions.resolutionsPerAuthority[0].values[0].value.name));
    const rawNumber = itemNumberSlot || (slots.ItemNumber && slots.ItemNumber.value);
    const index = rawNumber ? parseInt(rawNumber, 10) : NaN;

    if (Number.isNaN(index) || index < 1 || index > cart.length) {
      const speak = `申し訳ありません。削除する商品の番号は1から${cart.length}の間で教えてください。`;
      return handlerInput.responseBuilder.speak(speak).reprompt(`1から${cart.length}の番号で教えてください。`).getResponse();
    }

    const product = cart[index - 1];

    // 解析数量（口語的に対応）
    const parseQuantity = require('../utils/parseQuantity').parseSpokenQuantity;
    const rawQty = (slots.Quantity && (slots.Quantity.value || (slots.Quantity.resolutions && slots.Quantity.resolutions.resolutionsPerAuthority && slots.Quantity.resolutions.resolutionsPerAuthority[0] && slots.Quantity.resolutions.resolutionsPerAuthority[0].values && slots.Quantity.resolutions.resolutionsPerAuthority[0].values[0] && slots.Quantity.resolutions.resolutionsPerAuthority[0].values[0].value && slots.Quantity.resolutions.resolutionsPerAuthority[0].values[0].value.name))) || (slots.Quantity && slots.Quantity.value);
    let quantity = parseQuantity(rawQty);

    // 支持用户用 “全部” 表示删除整项
    const rawText = (rawQty || '').toString();
    if (/全部|全部削除|ぜんぶ|ぜんぶ削除/.test(rawText)) {
      quantity = null; // 删除整项标志
    }

    // 如果未提供数量，则询问用户要删除多少
    if (Number.isNaN(quantity)) {
      // 保存通用 pending 标志与数据，lastAction 为当前 Intent 名称（DeleteCartIntent）
      sessionAttributes.pending = true;
      sessionAttributes.pendingData = { kind: 'deleteQuantity', index, productId: product.id };
      attributesManager.setSessionAttributes(sessionAttributes);
      const speak = `${product.name} を何個削除しますか？ 全部削除する場合は「全部」と言ってください。`;
      const reprompt = '削除する個数を教えてください。例えば、1個、全部、のように答えてください。';
      return handlerInput.responseBuilder.speak(speak).reprompt(reprompt).getResponse();
    }

    // 有数量，执行删除或减少
    const cartUtils = require('../utils/cartUtils');
    const { cart: newCart, remainingQuantity, removedCompletely } = cartUtils.removeOrReduceCartItem(cart, product.id, quantity);
    sessionAttributes.cart = newCart;
    sessionAttributes._cartDirty = true;
    attributesManager.setSessionAttributes(sessionAttributes);

    const shortInfo = `${product.name}`;
    const speak = removedCompletely
      ? `${shortInfo} を削除しました。現在カートには ${newCart.length} 件の商品があります。`
      : `${shortInfo} を ${quantity} 個削除しました。残りは ${remainingQuantity} 個です。現在カートには ${newCart.length} 件の商品があります。`;
    return handlerInput.responseBuilder.speak(speak).reprompt('ほかに何をしますか？').getResponse();
  }
};
