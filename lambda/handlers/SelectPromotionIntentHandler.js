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
    console.log('Start handling SelectPromotionIntentHandler');
    try {
      const request = handlerInput.requestEnvelope;
      const intent = request.request.intent || { slots: {} };
      const slots = intent.slots ? Object.fromEntries(Object.entries(intent.slots).map(([k, v]) => [k, v && v.value])) : {};

      const attributesManager = handlerInput.attributesManager;
      const sessionAttributes = attributesManager.getSessionAttributes() || {};

      const availablePromos = sessionAttributes.availablePromos || [];
      if (!availablePromos || availablePromos.length === 0) {
        const spoken = '現在選択できるクーポンがありません。まずクーポンの確認を行ってください。';
        const { buildGenericCard, attachSpeechAndCard } = require('../utils/responseUtils');
        const card = buildGenericCard('クーポンがありません', spoken);
        const rb = attachSpeechAndCard(handlerInput.responseBuilder, spoken, 'クーポンがありません', card);
        return rb.reprompt('ほかに何をしますか？').getResponse();
      }

      const choiceRaw = parseInt(slots.PromoNumber, 10);
      // 如果没有提供选择并且仅有一个プロモーション，则默认选择第1项（便于测试ケース）
      let effectiveChoice = choiceRaw;
      if (Number.isNaN(effectiveChoice) && availablePromos.length === 1) {
        effectiveChoice = 1;
      }
      if (Number.isNaN(effectiveChoice) || effectiveChoice < 1 || effectiveChoice > availablePromos.length) {
        const spoken = `番号が正しくありません。1から${availablePromos.length}の番号でお知らせください。`;
        const { buildGenericCard, attachSpeechAndCard } = require('../utils/responseUtils');
        const card = buildGenericCard('番号が正しくありません', spoken);
        const rb = attachSpeechAndCard(handlerInput.responseBuilder, spoken, '番号が正しくありません', card);
        return rb.reprompt('どのクーポンにしますか？ 番号で教えてください。').getResponse();
      }

      const selected = availablePromos[effectiveChoice - 1];
      sessionAttributes.appliedPromo = selected;
      // mark cart/session as dirty so persistence layer saves the applied promo
      sessionAttributes._cartDirty = true;
      attributesManager.setSessionAttributes(sessionAttributes);

      // 適用後の最終金額を計算してユーザーに伝える
      const cart = sessionAttributes.cart || [];
      const deliveryFee = sessionAttributes.cartDelivery ? sessionAttributes.cartDelivery.fee || 0 : 0;
      const CheckoutService = require('../services/CheckoutService');
      const final = await CheckoutService.finalize(cart, deliveryFee, selected);

      // const { markLastAction } = require('../utils/sessionUtils'];
      // // mark last action as this intent
      // markLastAction(handlerInput, 'SelectPromotionIntent');

      // After applying the promotion, ask whether to proceed to payment
      sessionAttributes.pending = true;
      sessionAttributes.pendingData = { kind: 'confirmProceedToPayment' };
      attributesManager.setSessionAttributes(sessionAttributes);

      const spoken = `${selected.name}を適用しました。${final.summary} お支払いに進みますか？ はい、でお支払いに進みます、いいえ、の場合はほかに何をしますかと教えてください。`;
      const reprompt = 'お支払いに進みますか？ はい、またはいいえでお答えください。';
      const { attachSpeechAndCard, buildGenericCard } = require('../utils/responseUtils');
      const card = buildGenericCard('クーポンを適用しました', `${selected.name}\n${final.summary}`);
      const rb = attachSpeechAndCard(handlerInput.responseBuilder, spoken, 'クーポンを適用しました', card);
      return rb.reprompt(reprompt).getResponse();
    } finally {
      console.log('End handling SelectPromotionIntentHandler');
    }
  }
};
