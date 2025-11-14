const AddCartIntentHandler = require('../handlers/AddCartIntentHandler');

function mockAttributesManager(initial = {}) {
  let session = { ...initial };
  return {
    getSessionAttributes: () => session,
    setSessionAttributes: (s) => { session = s; },
    // for SaveCartInterceptor compatibility
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
      speak: function () { return this; },
      reprompt: function () { return this; },
      getResponse: function () { return {}; }
    }
  };
}

describe('AddCartIntentHandler', () => {
  test('adds item with quantity and merges same product', () => {
    // prepare lastSearchResults with a product
    const product = { id: 1, name: 'トマト', brand: 'JA農協', price: 200 };
    const sessionAttrs = { lastSearchResults: [product], cart: [{ id: 1, name: 'トマト', quantity: 1 }] };

    const slots = { ItemNumber: { value: '1' }, Quantity: { value: '2' } };
    const handlerInput = makeHandlerInput({ slots, sessionAttrs });

    const res = AddCartIntentHandler.handle(handlerInput);
    // ensure cart updated
    const after = handlerInput.attributesManager.getSessionAttributes();
    expect(after.cart).toBeDefined();
    expect(after.cart.length).toBe(1); // merged
    expect(after.cart[0].quantity).toBe(3); // 1 existing + 2 new
  });
});

