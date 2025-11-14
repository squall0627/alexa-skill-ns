const ClearCartIntentHandler = require('../handlers/ClearCartIntentHandler');

function mockAttributesManager(initial = {}) {
  let session = { ...initial };
  return {
    getSessionAttributes: () => session,
    setSessionAttributes: (s) => { session = s; },
    getPersistentAttributes: async () => ({}),
    setPersistentAttributes: () => {},
    savePersistentAttributes: async () => {}
  };
}

function makeHandlerInput({ intent = {}, sessionAttrs = {} } = {}) {
  return {
    requestEnvelope: {
      request: {
        type: 'IntentRequest',
        intent
      }
    },
    attributesManager: mockAttributesManager(sessionAttrs),
    responseBuilder: {
      speak: function (text) { this._s = text; return this; },
      reprompt: function () { return this; },
      getResponse: function () { return { spoken: this._s }; }
    }
  };
}

describe('ClearCartIntentHandler', () => {
  test('when confirmationStatus NONE asks for confirmation and sets pending flag', () => {
    const handlerInput = makeHandlerInput({ intent: { name: 'ClearCartIntent', confirmationStatus: 'NONE' }, sessionAttrs: { cart: [{ id:1 }] } });
    const res = ClearCartIntentHandler.handle(handlerInput);
    const after = handlerInput.attributesManager.getSessionAttributes();
    expect(after.pendingClearCart).toBe(true);
    expect(res.spoken).toMatch(/全部消してもよろしいですか/);
  });

  test('when confirmationStatus CONFIRMED clears cart', () => {
    const handlerInput = makeHandlerInput({ intent: { name: 'ClearCartIntent', confirmationStatus: 'CONFIRMED' }, sessionAttrs: { cart: [{ id:1 }], cartDelivery: { id: 'slot' } } });
    const res = ClearCartIntentHandler.handle(handlerInput);
    const after = handlerInput.attributesManager.getSessionAttributes();
    expect(after.cart).toBeUndefined();
    expect(res.spoken).toMatch(/カートを空にしました/);
  });

  test('when confirmationStatus DENIED does not clear', () => {
    const handlerInput = makeHandlerInput({ intent: { name: 'ClearCartIntent', confirmationStatus: 'DENIED' }, sessionAttrs: { cart: [{ id:1 }], cartDelivery: { id: 'slot' } } });
    const res = ClearCartIntentHandler.handle(handlerInput);
    const after = handlerInput.attributesManager.getSessionAttributes();
    expect(after.cart).toBeDefined();
    expect(res.spoken).toMatch(/キャンセルしました/);
  });
});

