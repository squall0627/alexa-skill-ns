const DeleteCartIntentHandler = require('../handlers/DeleteCartIntentHandler');

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

function makeHandlerInput({ slots = {}, sessionAttrs = {} } = {}) {
  return {
    requestEnvelope: {
      session: { sessionId: 'test-session' },
      request: {
        type: 'IntentRequest',
        intent: { slots }
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

describe('DeleteCartIntentHandler', () => {
  test('delete entire item when Quantity specified as all', () => {
    const cart = [{ id: 10, name: 'テスト商品', quantity: 2 }];
    const sessionAttrs = { cart };
    const slots = { ItemNumber: { value: '1' }, Quantity: { value: '全部' } };
    const handlerInput = makeHandlerInput({ slots, sessionAttrs });
    const res = DeleteCartIntentHandler.handle(handlerInput);
    const after = handlerInput.attributesManager.getSessionAttributes();
    expect(after.cart.length).toBe(0);
  });
});

