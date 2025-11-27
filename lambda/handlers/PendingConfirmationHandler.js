// lambda/handlers/PendingConfirmationHandler.js
// 日本語：降級確認（pendingClearCart / pendingCancelOrder）時に Yes/No を処理するハンドラ
const Alexa = require('ask-sdk-core');
const DeliveryAddressService = require('../services/DeliveryAddressService');
const PaymentService = require('../services/PaymentService');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    if (Alexa.getRequestType(request) !== 'IntentRequest') return false;
    const intentName = Alexa.getIntentName(request);
    if (intentName !== 'AMAZON.YesIntent' && intentName !== 'AMAZON.NoIntent') return false;
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes() || {};
    // handle only when generic pending flag is set and lastAction indicates a confirmation-type intent
    const pendingData = sessionAttributes.pendingData || {};
    // return Boolean(sessionAttributes.pending && (
    //   (sessionAttributes.lastAction === 'ClearCartIntent' && pendingData.kind === 'clearCart') ||
    //   (sessionAttributes.lastAction === 'StopOrderIntent' && pendingData.kind === 'stopOrder') ||
    //   (sessionAttributes.lastAction === 'SearchAvailableDeliveryAddressIntent' && pendingData.kind === 'confirmDefaultAddress') ||
    //   // after setting address, ask whether to check promotions
    //   pendingData.kind === 'confirmCheckPromotions' ||
    //   // payment-related pending kinds
    //   pendingData.kind === 'confirmUseWaon' ||
    //   pendingData.kind === 'confirmShareholderCard' ||
    //   pendingData.kind === 'confirmFinalizePayment'
    // ));
    return Boolean(sessionAttributes.pending && (
      pendingData.kind === 'clearCart' ||
      pendingData.kind === 'stopOrder' ||
      pendingData.kind === 'confirmDefaultAddress' ||
      // after selecting a delivery slot, ask whether to choose address
      pendingData.kind === 'confirmSelectAddressAfterSlot' ||
      // after setting address, ask whether to check promotions
      pendingData.kind === 'confirmCheckPromotions' ||
      // after selecting a promotion, ask whether to proceed to payment
      pendingData.kind === 'confirmProceedToPayment' ||
      // payment-related pending kinds
      pendingData.kind === 'confirmUseWaon' ||
      pendingData.kind === 'confirmShareholderCard' ||
      pendingData.kind === 'confirmFinalizePayment'
    ));
  },
  async handle(handlerInput) {
    console.log('Start handling PendingConfirmationHandler');
    try {
      const request = handlerInput.requestEnvelope;
      const intentName = Alexa.getIntentName(request);
      const attributesManager = handlerInput.attributesManager;
      const sessionAttributes = attributesManager.getSessionAttributes() || {};

      const isYes = intentName === 'AMAZON.YesIntent';
      // const isNo not needed; use else branch where appropriate

      // Handle pendingClearCart
      const orderUtils = require('../utils/orderUtils');
      // Determine which confirmation is pending based on pendingData.kind
      const pendingData = sessionAttributes.pendingData || {};
      // helper to strip outer <speak> wrapper
      const stripSpeak = (s) => String(s || '').replace(/^<speak>\s*/i, '').replace(/\s*<\/speak>$/i, '');
      // helper to build response with optional card; cardPlain overrides automatic extraction
      const respond = (ssmlOrPlain, reprompt, cardPlain) => {
        const isSSML = /<[^>]+>/.test(String(ssmlOrPlain));
        const rb = isSSML ? handlerInput.responseBuilder.speak(ssmlOrPlain) : handlerInput.responseBuilder.speak(String(ssmlOrPlain));
        if (reprompt) rb.reprompt(reprompt);
        // attach a simple card when available, prefer explicit cardPlain, otherwise derive from ssmlOrPlain
        if (typeof rb.withSimpleCard === 'function') {
          const cardText = cardPlain ? String(cardPlain) : (isSSML ? stripSpeak(ssmlOrPlain).replace(/<[^>]+>/g, '') : String(ssmlOrPlain));
          rb.withSimpleCard('確認', cardText);
        }
        return rb.getResponse();
      };

      if (sessionAttributes.pending && pendingData.kind === 'clearCart') {
        // clear the generic pending flag
        delete sessionAttributes.pending;
        delete sessionAttributes.pendingData;

        if (isYes) {
          // persist the cleared pending state before calling orderUtils
          attributesManager.setSessionAttributes(sessionAttributes);
          orderUtils.clearCartSession(attributesManager);
          const plain = 'カートをクリアしました。続けて、他の商品を購入しますか、それとも買い物を終了しますか？ 続けて購入する場合は商品名で検索してください、買い物を終了する場合は「注文終了」と言ってください。どちらにしますか？';
          const ssml = `<speak>カートをクリアしました。<break time="300ms"/>続けて、他の商品を購入しますか、それとも買い物を終了しますか？ 続けて購入する場合は商品名で検索してください、買い物を終了する場合は「注文終了」と言ってください。どちらにしますか？</speak>`;
          return respond(ssml, 'ほかに何をしますか？', plain);
        } else {
          // No -> cancel
          attributesManager.setSessionAttributes(sessionAttributes);
          const plain = 'カートのクリアをキャンセルしました。ほかに何をしますか？';
          const ssml = `<speak>カートのクリアをキャンセルしました。ほかに何をしますか？</speak>`;
          return respond(ssml, 'ほかに何をしますか？', plain);
        }
      }

      if (sessionAttributes.pending && pendingData.kind === 'stopOrder') {
        // clear pending
        delete sessionAttributes.pending;
        delete sessionAttributes.pendingData;
        if (isYes) {
          attributesManager.setSessionAttributes(sessionAttributes);
          await orderUtils.stopOrder(attributesManager);
          const plain = 'ご注文を中止しました。必要な場合はまた最初から注文を開始してください。';
          const ssml = `<speak>ご注文を中止しました。必要な場合はまた最初から注文を開始してください。</speak>`;
          return respond(ssml, null, plain);
        } else {
          // No -> cancel
          attributesManager.setSessionAttributes(sessionAttributes);
          const plain = '注文の中止をキャンセルしました。ほかに何をしますか？';
          const ssml = `<speak>注文の中止をキャンセルしました。ほかに何をしますか？</speak>`;
          return respond(ssml, 'ほかに何をしますか？', plain);
        }
      }

      // Handle confirming default/single delivery address
      if (sessionAttributes.pending && pendingData.kind === 'confirmDefaultAddress') {
        // clear pending
        delete sessionAttributes.pending;
        delete sessionAttributes.pendingData;

        if (isYes) {
          // get address by index
          const addrIndex = pendingData.addressIndex || 1;
          const address = await DeliveryAddressService.getAddressByIndex(attributesManager, addrIndex);
          if (address) {
            sessionAttributes.cartDeliveryAddress = address;
            sessionAttributes._cartDirty = true;
            attributesManager.setSessionAttributes(sessionAttributes);
            // 改訂：問い合わせを追加して、クーポンを確認するかを尋ねる
            // set a new pending state so the Yes/No for checking promotions is handled here
            sessionAttributes.pending = true;
            sessionAttributes.pendingData = { kind: 'confirmCheckPromotions' };
            attributesManager.setSessionAttributes(sessionAttributes);
            // prefer SSML label if available
            const addrLabelSSML = address.spokenLabelSSML ? stripSpeak(address.spokenLabelSSML) : address.spokenLabel;
            const plain = `届け先を ${address.spokenLabel} に設定しました。利用可能なクーポンを確認しますか？ はいで確認します、いいえでお支払いに進みます。`;
            const ssml = `<speak>届け先を ${addrLabelSSML} に設定しました。<break time="200ms"/>利用可能なクーポンを確認しますか？ はいで確認します、いいえでお支払いに進みます。</speak>`;
            return respond(ssml, '利用可能なクーポンを確認しますか？ はい、または、いいえ、でお答えください。', plain);
          } else {
            attributesManager.setSessionAttributes(sessionAttributes);
            const ssml = `<speak>申し訳ありません。届け先を設定できませんでした。もう一度やり直してください。</speak>`;
            return respond(ssml, 'もう一度お願いします。');
          }
        } else {
          // No -> cancel
          attributesManager.setSessionAttributes(sessionAttributes);
          const ssml = `<speak>届け先の設定をキャンセルしました。ほかに何をしますか？</speak>`;
          return respond(ssml, 'ほかに何をしますか？');
        }
      }

      // Handle: after confirming default address, ask whether to check available promotions
      if (sessionAttributes.pending && pendingData.kind === 'confirmCheckPromotions') {
        // clear generic pending flag
        delete sessionAttributes.pending;
        delete sessionAttributes.pendingData;

        if (isYes) {
          // Delegate to SearchAvailablePromotionIntentHandler to automatically announce promotions
          attributesManager.setSessionAttributes(sessionAttributes);
          const SearchAvailablePromotionIntentHandler = require('./SearchAvailablePromotionIntentHandler');
          // ensure lastAction is set so the promotion handler behaves normally
          sessionAttributes.lastAction = 'SearchAvailablePromotionIntent';
          attributesManager.setSessionAttributes(sessionAttributes);
          // call the handler and return its response (it returns a response object already)
          return await SearchAvailablePromotionIntentHandler.handle(handlerInput);
        } else {
          // No -> immediately start the payment flow by delegating to StartPaymentIntentHandler
          attributesManager.setSessionAttributes(sessionAttributes);
          // set lastAction so the StartPayment handler can detect context if needed
          sessionAttributes.lastAction = 'StartPaymentIntent';
          attributesManager.setSessionAttributes(sessionAttributes);
          const StartPaymentIntentHandler = require('./StartPaymentIntentHandler');
          // play a short transition prompt, then delegate to StartPaymentIntentHandler and combine responses
          const transitionSSML = `<speak>では、お支払いを開始します。<break time="200ms"/></speak>`;
          const startResp = await StartPaymentIntentHandler.handle(handlerInput);
          const startSpeak = (startResp && startResp.speak) ? startResp.speak : '';
          const startReprompt = (startResp && startResp.reprompt) ? startResp.reprompt : null;
          // combine transition and startResp.speak, handling SSML if present
          const inner = startSpeak ? stripSpeak(startSpeak) : '';
          const combined = `<speak>${stripSpeak(transitionSSML)} ${inner}</speak>`;
          if (startReprompt) return respond(combined, startReprompt);
          return respond(combined);
        }
      }

      // Handle: after selecting a delivery slot, ask user whether to select a delivery address now
      if (sessionAttributes.pending && pendingData.kind === 'confirmSelectAddressAfterSlot') {
        // clear pending flag
        delete sessionAttributes.pending;
        delete sessionAttributes.pendingData;

        if (isYes) {
          // Delegate to SearchAvailableDeliveryAddressIntentHandler so user can pick address
          attributesManager.setSessionAttributes(sessionAttributes);
          const SearchAvailableDeliveryAddressIntentHandler = require('./SearchAvailableDeliveryAddressIntentHandler');
          // set lastAction so the address search handler can behave as if invoked normally
          sessionAttributes.lastAction = 'SearchAvailableDeliveryAddressIntent';
          attributesManager.setSessionAttributes(sessionAttributes);
          return await SearchAvailableDeliveryAddressIntentHandler.handle(handlerInput);
        } else {
          // No -> proceed to promotion check flow (set pending to confirmCheckPromotions)
          sessionAttributes.pending = true;
          sessionAttributes.pendingData = { kind: 'confirmCheckPromotions' };
          attributesManager.setSessionAttributes(sessionAttributes);
          const plain = 'わかりました。利用可能なクーポンを確認しますか？ はいで確認します、いいえでお支払いに進みます。';
          const ssml = `<speak>わかりました。<break time="200ms"/>利用可能なクーポンを確認しますか？ はいで確認します、いいえでお支払いに進みます。</speak>`;
          return respond(ssml, '利用可能なクーポンを確認しますか？ はい、または、いいえ、でお答えください。', plain);
        }
      }

      // Payment-related pending: confirmUseWaon
      if (sessionAttributes.pending && pendingData.kind === 'confirmUseWaon') {
        // clear generic pending flag
        delete sessionAttributes.pending;
        delete sessionAttributes.pendingData;

        // ensure paymentFlow exists
        sessionAttributes.paymentFlow = sessionAttributes.paymentFlow || {};

        if (isYes) {
          // user wants to use WAON points -> ask how many
          sessionAttributes.paymentFlow.useWaon = true;
          sessionAttributes.lastAction = 'SpecifyWaonPointsIntent';
          attributesManager.setSessionAttributes(sessionAttributes);
          const balance = await PaymentService.getWaonBalance(attributesManager);
          const plain = `ご利用可能なWAONポイントは${balance}ポイントです。何ポイント使いますか？ 数字で教えてください。`;
          const ssml = `<speak>ご利用可能なWAONポイントは<say-as interpret-as="digits">${balance}</say-as>ポイントです。何ポイント使いますか？ 数字で教えてください。</speak>`;
          return respond(ssml, '何ポイント使いますか？', plain);
        } else {
          // No -> skip points and ask shareholder card
          sessionAttributes.paymentFlow.useWaon = false;
          sessionAttributes.paymentFlow.waonPoints = 0;
          // mark dirty because paymentFlow changed
          sessionAttributes._cartDirty = true;
          sessionAttributes.pending = true;
          sessionAttributes.pendingData = { kind: 'confirmShareholderCard' };
          attributesManager.setSessionAttributes(sessionAttributes);
          const plain = 'WAONポイントは使用しません。オーナーズカードを使いますか？ はい、または、いいえ、でお答えください。';
          const ssml = `<speak>WAONポイントは使用しません。<break time="200ms"/>オーナーズカードを使いますか？ はい、または、いいえ、でお答えください。</speak>`;
          return respond(ssml, 'オーナーズカードを使いますか？', plain);
        }
      }

      // Payment-related pending: confirmShareholderCard
      if (sessionAttributes.pending && pendingData.kind === 'confirmShareholderCard') {
        // clear generic pending flag
        delete sessionAttributes.pending;
        delete sessionAttributes.pendingData;

        sessionAttributes.paymentFlow = sessionAttributes.paymentFlow || {};
        sessionAttributes.paymentFlow.useShareholderCard = isYes;
        // mark dirty so shareholder card decision is persisted
        sessionAttributes._cartDirty = true;

        // After shareholder card decision, compute final amounts and ask final confirmation
        attributesManager.setSessionAttributes(sessionAttributes);
        // Delegate to ConfirmOrderIntentHandler to present the full order summary
        const ConfirmOrderIntentHandler = require('./ConfirmOrderIntentHandler');
        // set lastAction so ConfirmOrderIntentHandler can pick up
        sessionAttributes.lastAction = 'ConfirmOrderIntent';
        attributesManager.setSessionAttributes(sessionAttributes);
        // call the ConfirmOrder handler to build and speak the summary
        const fakeHandlerInput = Object.assign({}, handlerInput);
        return await ConfirmOrderIntentHandler.handle(fakeHandlerInput);
      }

      // Payment-related pending: confirmFinalizePayment
      if (sessionAttributes.pending && pendingData.kind === 'confirmFinalizePayment') {
        // clear pending
        delete sessionAttributes.pending;
        delete sessionAttributes.pendingData;

        if (isYes) {
          // perform payment
          attributesManager.setSessionAttributes(sessionAttributes);
          const paymentResult = await PaymentService.createPayment(attributesManager, sessionAttributes);
          if (paymentResult && paymentResult.success) {
            // finalize order: clear session and persistent order info
            const orderUtils = require('../utils/orderUtils');
            await orderUtils.finalizeOrderSuccess(attributesManager);
            const plain = `ご注文とお支払いを確定しました。お支払い金額は${paymentResult.totalAfterPoints}円、今回は${paymentResult.rewardPoints}点のWAON POINTを貰いました。ありがとうございました。`;
            const ssml = `<speak>ご注文とお支払いを確定しました。お支払い金額は<say-as interpret-as="digits">${paymentResult.totalAfterPoints}</say-as>円、今回は<say-as interpret-as="digits">${paymentResult.rewardPoints}</say-as>点のWAON POINTを貰いました。ありがとうございました。</speak>`;
            return respond(ssml, null, plain);
          } else {
            attributesManager.setSessionAttributes(sessionAttributes);
            const ssml = `<speak>申し訳ありません。支払い処理で問題が発生しました。もう一度お試しください。</speak>`;
            return respond(ssml, 'もう一度お試しになりますか？');
          }
        } else {
          // user cancelled final confirmation
          attributesManager.setSessionAttributes(sessionAttributes);
          const ssml = `<speak>注文を確定しませんでした。ほかに変更したい点はありますか？</speak>`;
          return respond(ssml, 'ほかに変更したい点はありますか？');
        }
      }

      // Handle: proceed to payment confirmation
      if (sessionAttributes.pending && pendingData.kind === 'confirmProceedToPayment') {
        // clear generic pending flag
        delete sessionAttributes.pending;
        delete sessionAttributes.pendingData;

        if (isYes) {
          // Directly start payment flow by delegating to StartPaymentIntentHandler and returning its response
          // persist sessionAttributes before delegating
          sessionAttributes.lastAction = 'StartPaymentIntent';
          attributesManager.setSessionAttributes(sessionAttributes);
          const StartPaymentIntentHandler = require('./StartPaymentIntentHandler');
          return await StartPaymentIntentHandler.handle(handlerInput);
        } else {
          // No -> ask user what they'd like to do next
          attributesManager.setSessionAttributes(sessionAttributes);
          const ssml = `<speak>わかりました。ほかに何をしますか？</speak>`;
          return respond(ssml, 'ほかに何をしますか？');
        }
      }

      // If somehow reached here, fallback
      return respond('<speak>すみません、処理できませんでした。</speak>');
    } finally {
      console.log('End handling PendingConfirmationHandler');
    }
  }
};
