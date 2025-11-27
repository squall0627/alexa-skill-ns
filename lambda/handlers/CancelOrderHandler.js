// lambda/handlers/CancelOrderHandler.js
// DEPRECATED: This handler has been replaced by `StopOrderHandler.js`.
// Keep a graceful response for backwards compatibility.

module.exports = {
  canHandle() {
    return false;
  },
  handle(handlerInput) {
    console.log('Start handling CancelOrderHandler');
    try {
      const speak = 'このハンドラは非推奨になりました。注文の中止は「注文を中止する」操作で行ってください。';
      const { attachSpeechAndCard, buildGenericCard } = require('../utils/responseUtils');
      const card = buildGenericCard('CancelOrder は非推奨', 'このハンドラは非推奨です。代わりに StopOrderIntent を使用してください。');
      const rb = attachSpeechAndCard(handlerInput.responseBuilder, speak, 'CancelOrder は非推奨', card);
      return rb.getResponse();
    } finally {
      console.log('End handling CancelOrderHandler');
    }
  }
};
