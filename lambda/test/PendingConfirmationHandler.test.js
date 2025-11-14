const PendingConfirmationHandler = require('../handlers/PendingConfirmationHandler');

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

function makeHandlerInput({ intentName = 'AMAZON.YesIntent', sessionAttrs = {}, persistentAttrs = {} } = {}) {
  return {
    requestEnvelope: {
      request: {
        type: 'IntentRequest',
        intent: { name: intentName }
      }
    },
    attributesManager: mockAttributesManager(persistentAttrs, sessionAttrs),
    responseBuilder: {
      speak: function (text) { this._s = text; return this; },
      reprompt: function (text) { this._r = text; return this; },
      getResponse: function () { return { spoken: this._s, reprompt: this._r }; }
    }
  };
}

describe('PendingConfirmationHandler', () => {
  test('pendingClearCart + Yes clears cart', async () => {
    const handlerInput = makeHandlerInput({ intentName: 'AMAZON.YesIntent', sessionAttrs: { pendingClearCart: true, cart: [{ id:1 }] } });
    const res = await PendingConfirmationHandler.handle(handlerInput);
    const after = handlerInput.attributesManager.getSessionAttributes();
    expect(after.cart).toBeUndefined();
    expect(after.pendingClearCart).toBeUndefined();
    expect(res.spoken).toMatch(/カートを空にしました/);
  });

  test('pendingClearCart + No cancels clear', async () => {
    const handlerInput = makeHandlerInput({ intentName: 'AMAZON.NoIntent', sessionAttrs: { pendingClearCart: true, cart: [{ id:1 }] } });
    const res = await PendingConfirmationHandler.handle(handlerInput);
    const after = handlerInput.attributesManager.getSessionAttributes();
    expect(after.cart).toBeDefined();
    expect(after.pendingClearCart).toBeUndefined();
    expect(res.spoken).toMatch(/クリアをキャンセルしました/);
  });

  test('pendingStopOrder + Yes clears persistent and session', async () => {
    const handlerInput = makeHandlerInput({ intentName: 'AMAZON.YesIntent', sessionAttrs: { pendingStopOrder: true, cart: [{ id:1 }], pendingAdd: {} }, persistentAttrs: { cartData: { cart: [{ id:1 }] }, currentOrder: { id: 'o1' } } });
    const res = await PendingConfirmationHandler.handle(handlerInput);
    const afterSession = handlerInput.attributesManager.getSessionAttributes();
    const afterPersistent = await handlerInput.attributesManager.getPersistentAttributes();
    expect(afterSession.cart).toBeUndefined();
    expect(afterSession.pendingStopOrder).toBeUndefined();
    expect(afterPersistent.cartData).toBeUndefined();
    expect(afterPersistent.currentOrder).toBeUndefined();
    expect(res.spoken).toMatch(/中止しました/);
  });

  test('pendingStopOrder + No cancels cancellation', async () => {
    const handlerInput = makeHandlerInput({ intentName: 'AMAZON.NoIntent', sessionAttrs: { pendingStopOrder: true, cart: [{ id:1 }] } });
    const res = await PendingConfirmationHandler.handle(handlerInput);
    const after = handlerInput.attributesManager.getSessionAttributes();
    expect(after.cart).toBeDefined();
    expect(after.pendingStopOrder).toBeUndefined();
    expect(res.spoken).toMatch(/中止をキャンセルしました|キャンセルしました/);
  });
});
