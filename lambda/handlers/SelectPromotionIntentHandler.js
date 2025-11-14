// lambda/handlers/SelectPromotionIntentHandler.js
// 日本語：ユーザーが番号でクーポンを選択して適用するハンドラ

const Alexa = require('ask-sdk-core');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes() || {};
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'SelectPromotionIntent' && sessionAttributes.lastAction === 'SearchAvailablePromotionIntent';
  },
  async handle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    const intent = request.request.intent || { slots: {} };
    const slots = intent.slots ? Object.fromEntries(Object.entries(intent.slots).map(([k, v]) => [k, v && v.value])) : {};

    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes() || {};

    const availablePromos = sessionAttributes.availablePromos || [];
    if (!availablePromos || availablePromos.length === 0) {
      const spoken = '現在選択できるクーポンがありません。まずクーポンの確認を行ってください。';
      return handlerInput.responseBuilder.speak(spoken).reprompt('ほかに何をしますか？').getResponse();
    }

    const choice = parseInt(slots.PromoNumber, 10);
    if (Number.isNaN(choice) || choice < 1 || choice > availablePromos.length) {
      const spoken = `番号が正しくありません。1から${availablePromos.length}の番号でお知らせください。`;
      return handlerInput.responseBuilder.speak(spoken).reprompt('どのクーポンにしますか？ 番号で教えてください。').getResponse();
    }

    const selected = availablePromos[choice - 1];
    sessionAttributes.appliedPromo = selected;
    attributesManager.setSessionAttributes(sessionAttributes);

    // 適用後の最終金額を計算してユーザーに伝える
    const cart = sessionAttributes.cart || [];
    const deliveryFee = sessionAttributes.cartDelivery ? sessionAttributes.cartDelivery.fee || 0 : 0;
    const CheckoutService = require('../services/CheckoutService');
    const final = await CheckoutService.finalize(cart, deliveryFee, selected);

    // const { markLastAction } = require('../utils/sessionUtils');
    // // mark last action as this intent
    // markLastAction(handlerInput, 'SelectPromotionIntent');

    const spoken = `${selected.name}を適用しました。${final.summary} ほかに何をしますか？`;
    return handlerInput.responseBuilder.speak(spoken).reprompt('ほかに何をしますか？').getResponse();
  }
};
