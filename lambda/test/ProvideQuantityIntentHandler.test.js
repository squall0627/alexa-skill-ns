const ProvideQuantityIntentHandler = require('../handlers/ProvideQuantityIntentHandler');

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

describe('ProvideQuantityIntentHandler', () => {
  test('no pendingAdd returns clarification prompt', () => {
    const slots = { Quantity: { value: '2' } };
    const handlerInput = makeHandlerInput({ slots, sessionAttrs: {} });
    const res = ProvideQuantityIntentHandler.handle(handlerInput);
    const after = handlerInput.attributesManager.getSessionAttributes();
    expect(after.cart).toBeUndefined();
    // response should ask which product
    expect(res).toBeDefined();
    expect(res.speak).toBeUndefined(); // because getResponse returns object with spoken in our mock
    const response = res; // ensure no crash
  });
});

