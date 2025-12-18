// 利用可能配送枠検索ハンドラ（SearchAvailableDeliverySlotIntentHandler）
// 指定条件に基づいて利用できる配送枠を検索し、上位候補を提示するハンドラ
const Alexa = require('ask-sdk-core');
const DeliverySlotService = require('../services/DeliverySlotService');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    return Alexa.getRequestType(request) === 'IntentRequest' && Alexa.getIntentName(request) === 'SearchAvailableDeliverySlotIntent';
  },

  async handle(handlerInput) {
    console.log('Start handling SearchAvailableDeliverySlotIntentHandler');
    try {
      const requestEnvelope = handlerInput.requestEnvelope;
      const intent = requestEnvelope.request.intent || { slots: {} };
      const slots = intent.slots ? Object.fromEntries(Object.entries(intent.slots).map(([k, v]) => [k, v && v.value])) : {};

      const attributesManager = handlerInput.attributesManager;
      const sessionAttributes = attributesManager.getSessionAttributes() || {};

      // mark lastAction early so follow-up handlers (e.g. SelectDeliverySlotIntent) can rely on it
      const { markLastAction } = require('../utils/sessionUtils');
      markLastAction(handlerInput, 'SearchAvailableDeliverySlotIntent');

      try {
        // カートの存在チェック
        const cart = sessionAttributes.cart || [];
        if (!cart || cart.length === 0) {
          const speak = 'カートに商品が入っていません。先に商品を選んでください。どの商品を探しますか？';
          const { attachSpeechAndCard, buildGenericCard } = require('../utils/responseUtils');
          const card = buildGenericCard('カートが空です', speak);
          const rb = attachSpeechAndCard(handlerInput.responseBuilder, speak, 'カートが空です', card);
          return rb.reprompt('どの商品を探しますか？').getResponse();
        }

        // ユーザーが日付／時間を指定した場合はそれを使う
        const date = slots.Date || undefined; // 期待される形式: YYYY-MM-DD
        const time = slots.Time || undefined; // 期待される形式: HH:MM あるいは "10:00-11:00"

        console.log('[SearchAvailableDeliverySlotIntent] Handling with slots:', { date, time });

        // サービス呼び出し
        const available = DeliverySlotService.getAvailableSlots({ date, time, limit: 3 });

        if (!available || available.length === 0) {
          const speak = '申し訳ありません。指定された条件で利用可能な配送枠が見つかりませんでした。別の日付や時間を指定するか、条件を変更してください。';
          const { attachSpeechAndCard, buildGenericCard } = require('../utils/responseUtils');
          const card = buildGenericCard('配送枠が見つかりません', speak);
          const rb = attachSpeechAndCard(handlerInput.responseBuilder, speak, '配送枠が見つかりません', card);
          return rb.reprompt('別の日付や時間を指定しますか？').getResponse();
        }

        // セッションに候補を保存しておく（後でユーザーが番号選択することを想定）
        sessionAttributes.availableDeliverySlots = available;
        attributesManager.setSessionAttributes(sessionAttributes);

        // 読み上げ文を作成（最大3件）
        // Plain text list for card/reprompt
        const listSpeech = available.map((s, i) => `番号${i + 1}、${s.spokenLabel}`).join('。 ');
        const reprompt = 'どの配送枠を選びますか？ 番号で教えてください。';

        // Build SSML: strip <speak> wrapper from service field if present
        const stripSpeak = (ssml) => String(ssml || '').replace(/^<speak>\s*/i, '').replace(/\s*<\/speak>$/i, '');
        const ssmlItems = available.map((s, i) => `<s>番号${i + 1}、${stripSpeak(s.spokenLabelSSML)}</s>`).join('<break time="400ms"/>');
        const ssml = `<speak>利用可能な配送枠を提示します。${ssmlItems}<break time="400ms"/>どの枠を選びますか？ 番号で教えてください。</speak>`;

        // Include a Simple card with plain text as a fallback/visual
        const cardText = `利用可能な配送枠:\n${available.map((s, i) => `${i + 1}. ${s.dateLabel} ${s.timeRange} (${s.fee === 0 ? '無料' : s.fee + '円'})`).join('\n')}`;

        const { buildGenericCard, attachSpeechAndCard } = require('../utils/responseUtils');
        const cardBody = buildGenericCard('利用可能な配送枠', listSpeech || cardText);
        const rbFinal = attachSpeechAndCard(handlerInput.responseBuilder, ssml, '利用可能な配送枠', cardBody);
        return rbFinal.reprompt(reprompt).getResponse();
      } catch (error) {
        console.error('[SearchAvailableDeliverySlotIntent] Error:', error);
        const speak = '申し訳ありません。配送枠の取得中にエラーが発生しました。もう一度お試しください。';
        const { attachSpeechAndCard, buildGenericCard } = require('../utils/responseUtils');
        const card = buildGenericCard('配送枠エラー', speak);
        const rb = attachSpeechAndCard(handlerInput.responseBuilder, speak, '配送枠エラー', card);
        return rb.reprompt('もう一度お試しください。').getResponse();
      }
    } finally {
      console.log('End handling SearchAvailableDeliverySlotIntentHandler');
    }
  }
};
