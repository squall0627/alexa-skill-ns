const StopOrderHandler = require('../handlers/StopOrderHandler');

function mockAttributesManager(initialPersistent = {}, initialSession = {}) {
  let persistent = { ...initialPersistent };
  let session = { ...initialSession };
  return {
    getSessionAttributes: () => session,
    setSessionAttributes: (s) => { session = s; },
    getPersistentAttributes: async () => persistent,
    setPersistentAttributes: (p) => { persistent = p; },
    savePersistentAttributes: async () => {}
  };
}

function makeHandlerInput({ intent = null, sessionAttrs = {}, persistentAttrs = {} } = {}) {
  const req = { type: 'IntentRequest' };
  if (intent) req.intent = intent;
  return {
    requestEnvelope: { request: req },
    attributesManager: mockAttributesManager(persistentAttrs, sessionAttrs),
    responseBuilder: {
      speak: function (text) { this._s = text; return this; },
      reprompt: function (text) { this._r = text; return this; },
      getResponse: function () { return { spoken: this._s, reprompt: this._r }; }
    }
  };
}

describe('StopOrderHandler (was CancelOrderHandler)', () => {
  test('clears persistent cartData and session order-related fields', async () => {
    const handlerInput = makeHandlerInput({ intent: { name: 'StopOrderIntent', confirmationStatus: 'CONFIRMED' }, sessionAttrs: { cart: [{ id:1 }], pendingAdd: { } }, persistentAttrs: { cartData: { cart: [{ id:1 }] }, currentOrder: { id: 'o1' } } });
    const res = await StopOrderHandler.handle(handlerInput);
    const afterSession = handlerInput.attributesManager.getSessionAttributes();
    const afterPersistent = await handlerInput.attributesManager.getPersistentAttributes();
    expect(afterSession.cart).toBeUndefined();
    expect(afterSession.pendingAdd).toBeUndefined();
    expect(afterPersistent.cartData).toBeUndefined();
    expect(afterPersistent.currentOrder).toBeUndefined();
    expect(res.spoken).toMatch(/中止しました/);
  });
});
