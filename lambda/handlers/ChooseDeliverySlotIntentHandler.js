// filepath: /Users/squall/develop/Alexa-skill-ns/lambda/handlers/ChooseDeliverySlotIntentHandler.js
// handlers/ChooseDeliverySlotIntentHandler.js
// 日本語：ユーザーが提示された配送枠の番号を選択したときのハンドラ
const Alexa = require('ask-sdk-core');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    const intentName = Alexa.getIntentName(request);
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes() || {};

    // このハンドラは ChooseDeliverySlotIntent で、直前アクションが selectDeliverySlot の場合に処理
    return Alexa.getRequestType(request) === 'IntentRequest' && intentName === 'ChooseDeliverySlotIntent' && sessionAttributes.lastAction === 'selectDeliverySlot';
  },

  async handle(handlerInput) {
    const requestEnvelope = handlerInput.requestEnvelope;
    const intent = requestEnvelope.request.intent || { slots: {} };
    const slots = intent.slots || {};
    const slotNumberValue = slots.SlotNumber && (slots.SlotNumber.value || (slots.SlotNumber.resolutions && slots.SlotNumber.resolutions.resolutionsPerAuthority && slots.SlotNumber.resolutions.resolutionsPerAuthority[0] && slots.SlotNumber.resolutions.resolutionsPerAuthority[0].values && slots.SlotNumber.resolutions.resolutionsPerAuthority[0].values[0] && slots.SlotNumber.resolutions.resolutionsPerAuthority[0].values[0].value.name));

    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes() || {};

    const available = sessionAttributes.availableDeliverySlots || [];

    if (!available || available.length === 0) {
      const speak = '申し訳ありません。利用可能な配送枠の候補が見つかりません。もう一度配達枠を表示しますか？';
      return handlerInput.responseBuilder.speak(speak).reprompt('配達枠を表示しますか？').getResponse();
    }

    const index = slotNumberValue ? parseInt(slotNumberValue, 10) : NaN;
    if (Number.isNaN(index) || index < 1 || index > available.length) {
      const speak = `申し訳ありません。番号は1から${available.length}の間で教えてください。どの枠を選びますか？`;
      return handlerInput.responseBuilder.speak(speak).reprompt('番号で教えてください。').getResponse();
    }

    const selected = available[index - 1];

    // カートに選択情報を保存（cart オブジェクトの deliverySlot に保存）
    // 簡潔化: sessionAttributes.cart を未定義なら空配列にする
    sessionAttributes.cart = sessionAttributes.cart || [];
    // カート全体に deliverySlot をつける（ここはシンプルにカートメタデータとして保存）
    sessionAttributes.cartDelivery = selected; // 保存キー: cartDelivery

    // クリア: availableDeliverySlots と lastAction を消す
    delete sessionAttributes.availableDeliverySlots;
    delete sessionAttributes.lastAction;

    // マークを立ててインターセプターに保存させる
    sessionAttributes._cartDirty = true;

    attributesManager.setSessionAttributes(sessionAttributes);

    // 永続化: attributesManager.savePersistentAttributes は SaveCartInterceptor が行うため
    // ここでは即時の persistent 保存は行わず、レスポンス後のインターセプターに委譲する

    const speak = `配送枠を選択しました。${selected.spokenLabel} を選択しました。お支払いに進みますか、それとも他に追加しますか？`;
    const reprompt = 'お支払いに進みますか、それとも続けて商品を追加しますか？';

    return handlerInput.responseBuilder.speak(speak).reprompt(reprompt).getResponse();
  }
};
