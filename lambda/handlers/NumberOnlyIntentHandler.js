// 数字のみインテントハンドラ（NumberOnlyIntentHandler）
// 数字だけの発話をキャプチャして、sessionAttributes.lastAction や pendingData に基づいて適切なハンドラにルーティングします。
const Alexa = require('ask-sdk-core');

const ProvideAddQuantityIntentHandler = require('./ProvideAddQuantityIntentHandler');
const ProvideDeleteQuantityIntentHandler = require('./ProvideDeleteQuantityIntentHandler');
const SelectDeliverySlotIntentHandler = require('./SelectDeliverySlotIntentHandler');
const SelectPromotionIntentHandler = require('./SelectPromotionIntentHandler');
const AddCartIntentHandler = require('./AddCartIntentHandler');
const SelectDeliveryAddressIntentHandler = require('./SelectDeliveryAddressIntentHandler');
const SelectPaymentMethodIntentHandler = require('./SelectPaymentMethodIntentHandler');
const SpecifyWaonPointsIntentHandler = require('./SpecifyWaonPointsIntentHandler');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    const intentName = Alexa.getIntentName(request);
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes() || {};

    // 数字のみ発話で NumberOnlyIntent のときのみ処理
    if (!(Alexa.getRequestType(request) === 'IntentRequest' && intentName === 'NumberOnlyIntent')) {
      return false;
    }

    // lastAction がない場合は介入しない
    if (!sessionAttributes.lastAction) return false;

    // サポートするフォローアップの lastAction の一覧
    const followUps = [
      'SearchProductIntent',
      'AddCartIntent',
      'DeleteCartIntent',
      'SearchAvailableDeliverySlotIntent',
      'SearchAvailablePromotionIntent',
      'SearchAvailableDeliveryAddressIntent',
      // payment-related
      'StartPaymentIntent',
      'SelectPaymentMethodIntent',
      'SpecifyWaonPointsIntent'
    ];
    return followUps.includes(sessionAttributes.lastAction);
  },

  async handle(handlerInput) {
    console.log('Start handling NumberOnlyIntentHandler');
    try {
      const requestEnvelope = handlerInput.requestEnvelope;
      const intent = requestEnvelope.request.intent || { slots: {} };
      const slots = intent.slots || {};
      const numberValue = slots.Number && (slots.Number.value || (slots.Number.resolutions && slots.Number.resolutions.resolutionsPerAuthority && slots.Number.resolutions.resolutionsPerAuthority[0] && slots.Number.resolutions.resolutionsPerAuthority[0].values && slots.Number.resolutions.resolutionsPerAuthority[0].values[0] && slots.Number.resolutions.resolutionsPerAuthority[0].values[0].value && slots.Number.resolutions.resolutionsPerAuthority[0].values[0].value.name));

      const attributesManager = handlerInput.attributesManager;
      const sessionAttributes = attributesManager.getSessionAttributes() || {};

      // Build a fake handlerInput for the target handler by cloning and replacing intent name/slots as needed
      const cloneRequestEnvelope = JSON.parse(JSON.stringify(requestEnvelope));

      const lastAction = sessionAttributes.lastAction;

      try {
        if (lastAction === 'SearchProductIntent') {
          // ユーザーが検索結果を見た後に番号を答えた場合は商品選択とみなす
          cloneRequestEnvelope.request.intent.name = 'AddCartIntent';
          cloneRequestEnvelope.request.intent.slots = { ItemNumber: { name: 'ItemNumber', value: numberValue } };
          const fakeHandlerInput = Object.assign({}, handlerInput, { requestEnvelope: cloneRequestEnvelope });
          return await AddCartIntentHandler.handle(fakeHandlerInput);
        }
        if (lastAction === 'AddCartIntent') {
          // ProvideAddQuantityIntentHandler にルーティング: Number -> Quantity
          cloneRequestEnvelope.request.intent.name = 'ProvideAddQuantityIntent';
          cloneRequestEnvelope.request.intent.slots = { Quantity: { name: 'Quantity', value: numberValue } };
          const fakeHandlerInput = Object.assign({}, handlerInput, { requestEnvelope: cloneRequestEnvelope });
          return await ProvideAddQuantityIntentHandler.handle(fakeHandlerInput);
        }

        if (lastAction === 'DeleteCartIntent') {
          // ProvideDeleteQuantityIntentHandler にルーティング: Number -> Quantity
          cloneRequestEnvelope.request.intent.name = 'ProvideDeleteQuantityIntent';
          cloneRequestEnvelope.request.intent.slots = { Quantity: { name: 'Quantity', value: numberValue } };
          const fakeHandlerInput = Object.assign({}, handlerInput, { requestEnvelope: cloneRequestEnvelope });
          return await ProvideDeleteQuantityIntentHandler.handle(fakeHandlerInput);
        }

        if (lastAction === 'SearchAvailableDeliverySlotIntent') {
          // SelectDeliverySlotIntentHandler にルーティング: Number -> SlotNumber
          cloneRequestEnvelope.request.intent.name = 'SelectDeliverySlotIntent';
          cloneRequestEnvelope.request.intent.slots = { SlotNumber: { name: 'SlotNumber', value: numberValue } };
          const fakeHandlerInput = Object.assign({}, handlerInput, { requestEnvelope: cloneRequestEnvelope });
          return await SelectDeliverySlotIntentHandler.handle(fakeHandlerInput);
        }

        if (lastAction === 'SearchAvailablePromotionIntent') {
          // SelectPromotionIntentHandler にルーティング: Number -> PromoNumber
          cloneRequestEnvelope.request.intent.name = 'SelectPromotionIntent';
          cloneRequestEnvelope.request.intent.slots = { PromoNumber: { name: 'PromoNumber', value: numberValue } };
          const fakeHandlerInput = Object.assign({}, handlerInput, { requestEnvelope: cloneRequestEnvelope });
          return await SelectPromotionIntentHandler.handle(fakeHandlerInput);
        }

        if (lastAction === 'SearchAvailableDeliveryAddressIntent') {
          // SelectDeliveryAddressIntentHandler にルーティング: Number -> AddressNumber
          cloneRequestEnvelope.request.intent.name = 'SelectDeliveryAddressIntent';
          cloneRequestEnvelope.request.intent.slots = { AddressNumber: { name: 'AddressNumber', value: numberValue } };
          const fakeHandlerInput = Object.assign({}, handlerInput, { requestEnvelope: cloneRequestEnvelope });
          return await SelectDeliveryAddressIntentHandler.handle(fakeHandlerInput);
        }

        // Payment-related numeric routing
        if (lastAction === 'StartPaymentIntent') {
          // Number corresponds to payment method selection
          cloneRequestEnvelope.request.intent.name = 'SelectPaymentMethodIntent';
          cloneRequestEnvelope.request.intent.slots = { PaymentNumber: { name: 'PaymentNumber', value: numberValue } };
          const fakeHandlerInput = Object.assign({}, handlerInput, { requestEnvelope: cloneRequestEnvelope });
          return await SelectPaymentMethodIntentHandler.handle(fakeHandlerInput);
        }

        if (lastAction === 'SpecifyWaonPointsIntent' || lastAction === 'SelectPaymentMethodIntent') {
          // Map number -> points
          cloneRequestEnvelope.request.intent.name = 'SpecifyWaonPointsIntent';
          cloneRequestEnvelope.request.intent.slots = { Points: { name: 'Points', value: numberValue } };
          const fakeHandlerInput = Object.assign({}, handlerInput, { requestEnvelope: cloneRequestEnvelope });
          return await SpecifyWaonPointsIntentHandler.handle(fakeHandlerInput);
        }

        // Fallback: let the IntentReflector or normal chain handle it
        const speak = '申し訳ありません。何の番号か分かりませんでした。もう一度言ってください。';
        const { attachSpeechAndCard, buildGenericCard } = require('../utils/responseUtils');
        const card = buildGenericCard('番号の解釈が不明', speak);
        const rb = attachSpeechAndCard(handlerInput.responseBuilder, speak, '番号の解釈が不明', card);
        return rb.reprompt(speak).getResponse();
      } catch (err) {
        console.log('[NumberOnlyIntentHandler] error routing:', err);
        const speak = '処理中にエラーが発生しました。もう一度お願いいたします。';
        const { attachSpeechAndCard, buildGenericCard } = require('../utils/responseUtils');
        const card = buildGenericCard('エラー', speak);
        const rb = attachSpeechAndCard(handlerInput.responseBuilder, speak, 'エラー', card);
        return rb.reprompt(speak).getResponse();
      }
    } finally {
      console.log('End handling NumberOnlyIntentHandler');
    }
  }
};
