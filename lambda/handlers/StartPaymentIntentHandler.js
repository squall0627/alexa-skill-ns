// 支払い開始ハンドラ（StartPaymentIntentHandler）
// 支払いフローの開始を処理するハンドラ
const Alexa = require('ask-sdk-core');
const PaymentService = require('../services/PaymentService');

module.exports = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope;
    if (Alexa.getRequestType(request) !== 'IntentRequest') return false;
    const intentName = Alexa.getIntentName(request);
    // このインテントはユーザーが「支払いに進む」と明示したときに呼ばれる想定
    return intentName === 'StartPaymentIntent';
  },

  async handle(handlerInput) {
    console.log('Start handling StartPaymentIntentHandler');
    try {
      const attributesManager = handlerInput.attributesManager;
      const sessionAttributes = attributesManager.getSessionAttributes() || {};

      // セッション内のpaymentFlowを初期化
      sessionAttributes.paymentFlow = {
        status: 'started',
        method: null,
        useWaon: null,
        waonPoints: null,
        useShareholderCard: null
      };
      // 新しいpaymentFlowが初期化されました - 永続化のためにdirtyフラグを立てる
      sessionAttributes._cartDirty = true;

      // NumberOnlyIntentHandlerによる数値応答のルーティングに使用されるlastAction
      sessionAttributes.lastAction = 'StartPaymentIntent';
      attributesManager.setSessionAttributes(sessionAttributes);

      const methods = PaymentService.getPaymentMethods();
      const parts = methods.map((m, idx) => `${idx + 1}番、${m.label}`).join('、');
      const speak = `お支払い方法を選択してください。${parts}。番号でお答えください。`;
      const reprompt = 'お支払い方法を番号で教えてください。例：2番。';

      const { buildGenericCard, attachSpeechAndCard } = require('../utils/responseUtils');
      const cardBody = buildGenericCard('お支払い方法', methods.map((m, i) => `${i + 1}. ${m.label}`).join('\n'));
      const rb = attachSpeechAndCard(handlerInput.responseBuilder, speak, 'お支払い方法を選択してください', cardBody);
      return rb.reprompt(reprompt).getResponse();
    } finally {
      console.log('End handling StartPaymentIntentHandler');
    }
  }
};
