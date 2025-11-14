// lambda/handlers/ProvideDeleteQuantityIntentHandler.js
// 日本語：ユーザーが削除数量を応答したときに pendingDelete を完成させるハンドラ
const Alexa = require('ask-sdk-core');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'ProvideDeleteQuantityIntent';
  },
  handle(handlerInput) {
    const requestEnvelope = handlerInput.requestEnvelope;
    const intent = requestEnvelope.request.intent || { slots: {} };
    const slots = intent.slots || {};

    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes() || {};

    const pending = sessionAttributes.pendingDelete;
    if (!pending || !pending.productId) {
      const speak = 'どの商品を削除するのか分かりませんでした。商品番号を教えてください。';
      return handlerInput.responseBuilder.speak(speak).reprompt('削除したい商品の番号を教えてください。').getResponse();
    }

    // 解析数量
    const parseQuantity = require('../utils/parseQuantity').parseSpokenQuantity;
    const quantitySlot = slots.Quantity && (slots.Quantity.value || (slots.Quantity.resolutions && slots.Quantity.resolutions.resolutionsPerAuthority && slots.Quantity.resolutions.resolutionsPerAuthority[0] && slots.Quantity.resolutions.resolutionsPerAuthority[0].values && slots.Quantity.resolutions.resolutionsPerAuthority[0].values[0] && slots.Quantity.resolutions.resolutionsPerAuthority[0].values[0].value && slots.Quantity.resolutions.resolutionsPerAuthority[0].values[0].value.name));
    const rawQty = quantitySlot || (slots.Quantity && slots.Quantity.value);
    let quantity = parseQuantity(rawQty);

    // support word '全部' as delete all
    const rawText = (rawQty || '').toString();
    if (/全部|全部削除|ぜんぶ/.test(rawText)) {
      quantity = null; // means delete entire item
    }

    if (Number.isNaN(quantity) && quantity !== null) {
      const speak = '個数がわかりませんでした。何個削除しますか？';
      return handlerInput.responseBuilder.speak(speak).reprompt('削除する個数を教えてください。').getResponse();
    }

    const cart = sessionAttributes.cart || [];
    const cartUtils = require('../utils/cartUtils');
    const { cart: newCart, removedItem, remainingQuantity, removedCompletely } = cartUtils.removeOrReduceCartItem(cart, pending.productId, quantity);

    sessionAttributes.cart = newCart;
    sessionAttributes.lastAction = 'afterDelete';
    sessionAttributes._cartDirty = true;
    delete sessionAttributes.pendingDelete;
    attributesManager.setSessionAttributes(sessionAttributes);

    const speak = removedCompletely
      ? `項目を削除しました。現在カートには ${newCart.length} 件の商品があります。`
      : `指定の個数を削除しました。残りは ${remainingQuantity} 個です。現在カートには ${newCart.length} 件の商品があります。`;

    return handlerInput.responseBuilder.speak(speak).reprompt('ほかに何をしますか？').getResponse();
  }
};

