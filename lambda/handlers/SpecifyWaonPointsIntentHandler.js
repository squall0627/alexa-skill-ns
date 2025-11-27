// lambda/handlers/SpecifyWaonPointsIntentHandler.js
const Alexa = require('ask-sdk-core');
const PaymentService = require('../services/PaymentService');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    const intentName = Alexa.getIntentName(request);
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes() || {};
    // Mirror SelectDeliverySlotIntentHandler style: accept explicit SpecifyWaonPointsIntent
    // or NumberOnlyIntent when lastAction === 'SpecifyWaonPointsIntent'
    return (Alexa.getRequestType(request) === 'IntentRequest' && intentName === 'SpecifyWaonPointsIntent' && (sessionAttributes.lastAction === 'SpecifyWaonPointsIntent' || sessionAttributes.lastAction === 'SelectPaymentMethodIntent'));
  },

  async handle(handlerInput) {
    console.log('Start handling SpecifyWaonPointsIntentHandler');
    try {
      const requestEnvelope = handlerInput.requestEnvelope;
      const intent = requestEnvelope.request.intent || { slots: {} };
      const slots = intent.slots || {};
      const rawValue = (slots.Points && (slots.Points.value || (slots.Points.resolutions && slots.Points.resolutions.resolutionsPerAuthority && slots.Points.resolutions.resolutionsPerAuthority[0] && slots.Points.resolutions.resolutionsPerAuthority[0].values && slots.Points.resolutions.resolutionsPerAuthority[0].values[0] && slots.Points.resolutions.resolutionsPerAuthority[0].values[0].value && slots.Points.resolutions.resolutionsPerAuthority[0].values[0].value.name))) || (slots.Number && slots.Number.value) || null;
      // Fallback: if slot not populated, try the raw input transcript (ASR) which sometimes contains the text
      const inputTranscript = requestEnvelope.request && requestEnvelope.request.inputTranscript ? requestEnvelope.request.inputTranscript : null;
      const effectiveRaw = rawValue || inputTranscript;

      const attributesManager = handlerInput.attributesManager;
      const sessionAttributes = attributesManager.getSessionAttributes() || {};

      // Debug: log slots and transcript to help diagnose parsing issues (remove in production)
      try {
        console.log('[SpecifyWaonPoints] slots:', JSON.stringify(slots));
        console.log('[SpecifyWaonPoints] rawValue:', rawValue);
        console.log('[SpecifyWaonPoints] inputTranscript:', inputTranscript);
      } catch (e) { /* ignore logging errors */ }

      // helper: convert full-width digits to half-width
      function toHalfWidth(str) {
        return String(str).replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248));
      }

      // parse the raw slot value robustly
      let points = null;
      if (effectiveRaw !== null && effectiveRaw !== undefined) {
        let rv = String(effectiveRaw).trim();
        rv = toHalfWidth(rv);
        // check for keywords meaning use all points
        if (/^(全部|全て|ぜんぶ|全部使う|ぜんぶ使う)$/i.test(rv)) {
          const balance = await PaymentService.getWaonBalance(attributesManager);
          points = Number(balance || 0);
        } else {
          // extract first integer occurrence
          const m = rv.match(/-?\d+/);
          if (m && m[0]) {
            points = parseInt(m[0], 10);
          } else if (!isNaN(Number(rv))) {
            points = Number(rv);
          }
        }
      }

      // If slot was empty or parsing failed, reprompt (do not coerce null -> 0)
      if (points === null || !Number.isInteger(points) || points < 0) {
        // keep lastAction so NumberOnlyIntent will route here
        sessionAttributes.lastAction = 'SpecifyWaonPointsIntent';
        attributesManager.setSessionAttributes(sessionAttributes);
        const speak = '申し訳ありません。使うポイント数を数字で教えてください。例えば、100とお答えください。';
        const ssml = `<speak>申し訳ありません。使うポイント数を数字で教えてください。例えば、<say-as interpret-as="cardinal">100</say-as>とお答えください。</speak>`;
        const { attachSpeechAndCard, buildGenericCard } = require('../utils/responseUtils');
        const card = buildGenericCard('ポイントを入力してください', speak);
        const rb = attachSpeechAndCard(handlerInput.responseBuilder, ssml, 'ポイントを入力してください', card);
        return rb.reprompt('使うポイント数を数字で教えてください。').getResponse();
      }

      const validation = await PaymentService.validateWaonPoints(attributesManager, points);
      if (!validation.ok) {
        if (validation.reason === 'invalid') {
          const speak = '申し訳ありません。ポイント数は整数で教えてください。何ポイント使いますか？';
          const ssml = `<speak>申し訳ありません。ポイント数は整数で教えてください。何ポイント使いますか？</speak>`;
          const { attachSpeechAndCard, buildGenericCard } = require('../utils/responseUtils');
          const card = buildGenericCard('ポイント数エラー', speak);
          const rb = attachSpeechAndCard(handlerInput.responseBuilder, ssml, 'ポイント数エラー', card);
          return rb.reprompt('使うポイント数を数字で教えてください。').getResponse();
        }
        if (validation.reason === 'insufficient') {
          const speak = `申し訳ありません。利用可能なポイントは${validation.balance}ポイントです。何ポイント使いますか？`;
          const ssml = `<speak>申し訳ありません。利用可能なポイントは<say-as interpret-as="cardinal">${validation.balance}</say-as>ポイントです。何ポイント使いますか？</speak>`;
          const { attachSpeechAndCard, buildGenericCard } = require('../utils/responseUtils');
          const card = buildGenericCard('ポイント不足', speak);
          const rb = attachSpeechAndCard(handlerInput.responseBuilder, ssml, 'ポイント不足', card);
          return rb.reprompt('使うポイント数を数字で教えてください。').getResponse();
        }
      }

      // Save points
      sessionAttributes.paymentFlow = sessionAttributes.paymentFlow || {};
      sessionAttributes.paymentFlow.useWaon = true;
      sessionAttributes.paymentFlow.waonPoints = points;
      // mark dirty so waon points selection is persisted
      sessionAttributes._cartDirty = true;
      sessionAttributes.lastAction = 'SpecifyWaonPointsIntent';

      // After points specified, ask about shareholder card
      sessionAttributes.pending = true;
      sessionAttributes.pendingData = { kind: 'confirmShareholderCard' };
      attributesManager.setSessionAttributes(sessionAttributes);

      // Compute interim summary
      const computed = await PaymentService.computeFinalAmounts(attributesManager, sessionAttributes);
      const plain = `${points}ポイントを使用します。現在の支払合計は${computed.totalAfterPoints}円です。オーナーズカードを利用しますか？ はい、またはいいえでお答えください。`;
      const ssml = `<speak><say-as interpret-as="cardinal">${points}</say-as>ポイントを使用します。現在の支払合計は<say-as interpret-as="cardinal">${computed.totalAfterPoints}</say-as>円です。オーナーズカードを利用しますか？ はい、またはいいえでお答えください。</speak>`;
      const { attachSpeechAndCard, buildGenericCard } = require('../utils/responseUtils');
      const card = buildGenericCard('支払合計の確認', plain);
      const rb = attachSpeechAndCard(handlerInput.responseBuilder, ssml, '支払合計の確認', card);
      return rb.reprompt('オーナーズカードを利用しますか？').getResponse();
    } finally {
      console.log('End handling SpecifyWaonPointsIntentHandler');
    }
  }
};
