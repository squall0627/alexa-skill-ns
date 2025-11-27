// lambda/handlers/ConfirmOrderIntentHandler.js
const Alexa = require('ask-sdk-core');
const PaymentService = require('../services/PaymentService');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    const intentName = Alexa.getIntentName(request);
    // Accept explicit ConfirmOrderIntent or when lastAction was set to 'ConfirmOrderIntent'
    return Alexa.getRequestType(request) === 'IntentRequest' && intentName === 'ConfirmOrderIntent';
  },

  async handle(handlerInput) {
    console.log('Start handling ConfirmOrderIntentHandler');
    try {
      const attributesManager = handlerInput.attributesManager;
      const sessionAttributes = attributesManager.getSessionAttributes() || {};

      // Build a readable order summary in Japanese
      const cart = sessionAttributes.cart || [];
      if (!Array.isArray(cart) || cart.length === 0) {
        const speak = 'カートに商品がありません。注文を確定できません。買い物するなら、「リンゴを探して」というふうに商品を検索してください？';
        const { buildGenericCard, attachSpeechAndCard } = require('../utils/responseUtils');
        const card = buildGenericCard('カートが空です', speak);
        const rb = attachSpeechAndCard(handlerInput.responseBuilder, speak, 'カートが空です', card);
        return rb.reprompt('ほかに何をしますか？').getResponse();
      }

      const itemsText = cart.map((it, i) => {
        // Determine actual selling unit price: prefer promoPrice when it's lower than base price
        const basePrice = it.price || it.unitPrice || 0;
        const unitPrice = (typeof it.promoPrice === 'number' && it.promoPrice < basePrice) ? it.promoPrice : basePrice;
        return `番号${i + 1}、${it.name || it.title || '商品'}、${it.quantity || 1}個、単価${unitPrice}円`;
      }).join('。 ');

      // Build delivery text from both cartDelivery and cartDeliveryAddress when available
      const cartDelivery = sessionAttributes.cartDelivery;
      const cartDeliveryAddress = sessionAttributes.cartDeliveryAddress;
      // Compose explicit, labeled delivery text with per-field unset checks
      const deliveryMethodLabel = (cartDelivery && cartDelivery.spokenLabel) ? cartDelivery.spokenLabel : '未設定';
      const deliveryAddressLabel = (cartDeliveryAddress && cartDeliveryAddress.spokenLabel) ? cartDeliveryAddress.spokenLabel : '未設定';
      const delivery = `配送便：${deliveryMethodLabel}。届け先：${deliveryAddressLabel}`;

      const promo = sessionAttributes.appliedPromo ? sessionAttributes.appliedPromo.name : 'クーポン未使用';
      const paymentFlow = sessionAttributes.paymentFlow || {};
      const methodLabel = (paymentFlow.method === 'cash' && '現金') || (paymentFlow.method === 'credit' && 'クレジットカード') || (paymentFlow.method === 'aeon' && 'イオンペイ') || '未設定';
      const waonUse = paymentFlow.useWaon ? `WAONポイントを${paymentFlow.waonPoints || 0}ポイント使用` : 'WAONポイント未使用';
      const share = paymentFlow.useShareholderCard ? 'オーナーズカードを使用' : 'オーナーズカード未使用';

      const computed = await PaymentService.computeFinalAmounts(attributesManager, sessionAttributes);

      // Assemble full summary
      const speak = `ご注文の確認です。商品：${itemsText}。配達：${delivery}。クーポン：${promo}。お支払い方法：${methodLabel}。${waonUse}。${share}。${computed.summary} 注文を確定してよろしいですか？はい、または、いいえ、で回答してください。`;

      // set pending for final confirmation handled by PendingConfirmationHandler
      sessionAttributes.pending = true;
      sessionAttributes.pendingData = { kind: 'confirmFinalizePayment' };
      sessionAttributes.lastAction = 'ConfirmOrderIntent';
      attributesManager.setSessionAttributes(sessionAttributes);

      const { buildCartCard, buildGenericCard, attachSpeechAndCard } = require('../utils/responseUtils');
      // Use cart card when possible, fallback to generic
      const card = buildCartCard(cart) || buildGenericCard('注文内容の確認', `${itemsText}\n${delivery}\n${promo}\n${methodLabel}\n${waonUse}`);
      const rb = attachSpeechAndCard(handlerInput.responseBuilder, speak, '注文内容の確認', card);
      return rb.reprompt('注文を確定してよろしいですか？ はい／いいえでお答えください。').getResponse();
    } finally {
      console.log('End handling ConfirmOrderIntentHandler');
    }
  }
};
