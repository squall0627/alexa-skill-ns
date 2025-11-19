// lambda/handlers/StartPaymentIntentHandler.js
// 支払いフローの開始ハンドラ
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

      // Initialize paymentFlow in session
      sessionAttributes.paymentFlow = {
        status: 'started',
        method: null,
        useWaon: null,
        waonPoints: null,
        useShareholderCard: null
      };

      // lastAction used by NumberOnlyIntentHandler to route numeric replies
      sessionAttributes.lastAction = 'StartPaymentIntent';
      attributesManager.setSessionAttributes(sessionAttributes);

      const methods = PaymentService.getPaymentMethods();
      const parts = methods.map((m, idx) => `${idx + 1}番、${m.label}`).join('、');
      const speak = `お支払い方法を選択してください。${parts}。番号でお答えください。`;
      const reprompt = 'お支払い方法を番号で教えてください。例：2番。';

      return handlerInput.responseBuilder.speak(speak).reprompt(reprompt).getResponse();
    } finally {
      console.log('End handling StartPaymentIntentHandler');
    }
  }
};
