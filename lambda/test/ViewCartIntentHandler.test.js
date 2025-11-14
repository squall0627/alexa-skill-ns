const ViewCartIntentHandler = require('../handlers/ViewCartIntentHandler');

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

function makeHandlerInput({ sessionAttrs = {} } = {}) {
  return {
    requestEnvelope: {
      session: { sessionId: 'test-session' },
      request: { type: 'IntentRequest', intent: { slots: {} } }
    },
    attributesManager: mockAttributesManager(sessionAttrs),
    responseBuilder: {
      speak: function (text) { this._s = text; return this; },
      reprompt: function () { return this; },
      getResponse: function () { return { spoken: this._s }; }
    }
  };
}

describe('ViewCartIntentHandler', () => {
  test('empty cart returns prompt', () => {
    const handlerInput = makeHandlerInput({ sessionAttrs: { cart: [] } });
    const res = ViewCartIntentHandler.handle(handlerInput);
    expect(res).toBeDefined();
    expect(res.spoken).toMatch(/カートに商品が入っていません/);
  });

  test('cart with items reads out items', () => {
    const cart = [
      { id: 1, name: 'トマト', price: 200, promoPrice: 150, quantity: 2 },
      { id: 2, name: 'バナナ', price: 120, quantity: 1 }
    ];
    const handlerInput = makeHandlerInput({ sessionAttrs: { cart } });
    const res = ViewCartIntentHandler.handle(handlerInput);
    expect(res).toBeDefined();
    expect(res.spoken).toMatch(/番号1/);
    expect(res.spoken).toMatch(/トマト/);
    expect(res.spoken).toMatch(/特別価格は150円/);
    expect(res.spoken).toMatch(/合計で2種類/);
  });
});

