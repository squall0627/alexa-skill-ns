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
    return Boolean(sessionAttributes.pending && (
      (sessionAttributes.lastAction === 'ClearCartIntent' && pendingData.kind === 'clearCart') ||
      (sessionAttributes.lastAction === 'StopOrderIntent' && pendingData.kind === 'stopOrder') ||
      (sessionAttributes.lastAction === 'SearchAvailableDeliveryAddressIntent' && pendingData.kind === 'confirmDefaultAddress') ||
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
      if (sessionAttributes.pending && pendingData.kind === 'clearCart') {
        // clear the generic pending flag
        delete sessionAttributes.pending;
        delete sessionAttributes.pendingData;

        if (isYes) {
          // persist the cleared pending state before calling orderUtils
          attributesManager.setSessionAttributes(sessionAttributes);
          orderUtils.clearCartSession(attributesManager);
          const speak = 'カートを空にしました。ほかに何をしますか？';
          return handlerInput.responseBuilder.speak(speak).reprompt('ほかに何をしますか？').getResponse();
        } else {
          // No -> cancel
          attributesManager.setSessionAttributes(sessionAttributes);
          const speak = 'カートのクリアをキャンセルしました。ほかに何をしますか？';
          return handlerInput.responseBuilder.speak(speak).reprompt('ほかに何をしますか？').getResponse();
        }
      }

      if (sessionAttributes.pending && pendingData.kind === 'stopOrder') {
        // clear pending
        delete sessionAttributes.pending;
        delete sessionAttributes.pendingData;
        if (isYes) {
          attributesManager.setSessionAttributes(sessionAttributes);
          await orderUtils.stopOrder(attributesManager);
          const speak = 'ご注文を中止しました。必要な場合はまた最初から注文を開始してください。';
          return handlerInput.responseBuilder.speak(speak).getResponse();
        } else {
          // No -> cancel
          attributesManager.setSessionAttributes(sessionAttributes);
          const speak = '注文の中止をキャンセルしました。ほかに何をしますか？';
          return handlerInput.responseBuilder.speak(speak).reprompt('ほかに何をしますか？').getResponse();
        }
      }

      // Handle confirming default/single delivery address
      if (sessionAttributes.pending && pendingData.kind === 'confirmDefaultAddress' && sessionAttributes.lastAction === 'SearchAvailableDeliveryAddressIntent') {
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
            const speak = `配送先を ${address.spokenLabel} に設定しました。お支払いに進みますか？`;
            return handlerInput.responseBuilder.speak(speak).reprompt('お支払いに進みますか？').getResponse();
          } else {
            attributesManager.setSessionAttributes(sessionAttributes);
            const speak = '申し訳ありません。配送先を設定できませんでした。もう一度やり直してください。';
            return handlerInput.responseBuilder.speak(speak).reprompt('もう一度お願いします。').getResponse();
          }
        } else {
          // No -> cancel
          attributesManager.setSessionAttributes(sessionAttributes);
          const speak = '配送先の設定をキャンセルしました。ほかに何をしますか？';
          return handlerInput.responseBuilder.speak(speak).reprompt('ほかに何をしますか？').getResponse();
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
          const speak = `ご利用可能なWAONポイントは${balance}ポイントです。何ポイント使いますか？ 数字で教えてください。`;
          return handlerInput.responseBuilder.speak(speak).reprompt('何ポイント使いますか？').getResponse();
        } else {
          // No -> skip points and ask shareholder card
          sessionAttributes.paymentFlow.useWaon = false;
          sessionAttributes.paymentFlow.waonPoints = 0;
          // mark dirty because paymentFlow changed
          sessionAttributes._cartDirty = true;
          sessionAttributes.pending = true;
          sessionAttributes.pendingData = { kind: 'confirmShareholderCard' };
          attributesManager.setSessionAttributes(sessionAttributes);
          const speak = 'WAONポイントは使用しません。オーナーズカードをお持ちですか？ はい、またはいいえでお答えください。';
          return handlerInput.responseBuilder.speak(speak).reprompt('オーナーズカードを使いますか？').getResponse();
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
            const speak = `ご注文とお支払いを確定しました。お支払い金額は${paymentResult.totalAfterPoints}円、今回の返点は${paymentResult.rewardPoints}点です。ありがとうございました。`;
            return handlerInput.responseBuilder.speak(speak).getResponse();
          } else {
            attributesManager.setSessionAttributes(sessionAttributes);
            const speak = '申し訳ありません。支払い処理で問題が発生しました。もう一度お試しください。';
            return handlerInput.responseBuilder.speak(speak).reprompt('もう一度お試しになりますか？').getResponse();
          }
        } else {
          // user cancelled final confirmation
          attributesManager.setSessionAttributes(sessionAttributes);
          const speak = '注文を確定しませんでした。ほかに変更したい点はありますか？';
          return handlerInput.responseBuilder.speak(speak).reprompt('ほかに変更したい点はありますか？').getResponse();
        }
      }

      // If somehow reached here, fallback
      return handlerInput.responseBuilder.speak('すみません、処理できませんでした。').getResponse();
    } finally {
      console.log('End handling PendingConfirmationHandler');
    }
  }
};
