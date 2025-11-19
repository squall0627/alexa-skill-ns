// lambda/handlers/CancelOrderHandler.js
// DEPRECATED: This handler has been replaced by `StopOrderHandler.js`.
// Kept as a stub for compatibility. Please use `./StopOrderHandler` instead.

module.exports = {
  canHandle() {
    return false;
  },
  handle() {
    console.log('Start handling CancelOrderHandler');
    try {
      throw new Error('CancelOrderHandler is deprecated; use StopOrderHandler instead.');
    } finally {
      console.log('End handling CancelOrderHandler');
    }
  }
};
