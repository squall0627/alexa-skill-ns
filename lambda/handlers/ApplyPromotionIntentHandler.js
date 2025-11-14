// lambda/handlers/ApplyPromotionIntentHandler.js
// 日本語：プロモーション（クーポン）を提示・適用する Intent ハンドラ

const Alexa = require('ask-sdk-core');
const CheckoutService = require('../services/CheckoutService');
const PromotionService = require('../services/PromotionService');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'ApplyPromotionIntent';
  },
  async handle(handlerInput) {
    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes() || {};

    const cart = sessionAttributes.cart || [];
    if (!cart || cart.length === 0) {
      const spoken = 'カートに商品が入っていません。まず商品を追加してください。';
      return handlerInput.responseBuilder.speak(spoken).reprompt('ほかに何をしますか？').getResponse();
    }

    // 配送料はセッション属性またはデフォルト
    const deliveryFee = sessionAttributes.cartDelivery ? sessionAttributes.cartDelivery.fee || 0 : 0;
    const calc = await CheckoutService.calculate(cart, deliveryFee);

    if (!calc.availablePromos || calc.availablePromos.length === 0) {
      // 利用可能なプロモーションがない場合、閾値に達していないプロモーションを案内
      // 全プロモーションを取得して、まだ到達していないプロモーションを列挙する
      const TableHandler = require('../tables/TableHandler');
      const promosTable = new TableHandler('promotions');
      const allPromos = await promosTable.readAll();
      const notReached = allPromos.filter(p => calc.itemsTotal < (p.orderThreshold || 0));
      if (notReached.length === 0) {
        const spoken = `現在利用可能なクーポンはありません。合計金額は${calc.subtotal}円です。`;
        return handlerInput.responseBuilder.speak(spoken).reprompt('ほかに何をしますか？').getResponse();
      }
      // 提示どのくらい追加購入すれば良いかを案内（最小閾値との差分）
      const messages = notReached.map(p => {
        const diff = (p.orderThreshold || 0) - calc.itemsTotal;
        return `${p.name}（合計${p.orderThreshold}円以上で${p.discountAmount}円引き）には、あと${diff}円のご購入で利用できます。`;
      }).join(' ');
      const spoken = `現在の合計は${calc.itemsTotal}円です。${messages}`;
      return handlerInput.responseBuilder.speak(spoken).reprompt('ほかに何をしますか？').getResponse();
    }

    // 利用可能なプロモーションを列挙してユーザーに選択を促す
    const promos = calc.availablePromos;
    const promoStrings = promos.map((p, i) => `番号${i + 1}、${p.name}、${p.discountAmount}円引き（条件${p.orderThreshold}円以上）`).join('。 ');
    const spoken = `利用可能なクーポンがあります：${promoStrings}。どのクーポンを利用しますか？ 番号で教えてください。`;

    // セッションに利用候補を保存
    sessionAttributes.availablePromos = promos;
    attributesManager.setSessionAttributes(sessionAttributes);

    return handlerInput.responseBuilder.speak(spoken).reprompt('どのクーポンを利用しますか？').getResponse();
  }
};
