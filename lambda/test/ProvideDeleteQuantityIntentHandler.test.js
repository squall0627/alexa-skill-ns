const ProvideDeleteQuantityIntentHandler = require('../handlers/ProvideDeleteQuantityIntentHandler');

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

describe('ProvideDeleteQuantityIntentHandler', () => {
  test('no pendingDelete returns clarification prompt', () => {
    const slots = { Quantity: { value: '1' } };
    const handlerInput = makeHandlerInput({ slots, sessionAttrs: {} });
    const res = ProvideDeleteQuantityIntentHandler.handle(handlerInput);
    const after = handlerInput.attributesManager.getSessionAttributes();
    expect(after.cart).toBeUndefined();
    expect(res).toBeDefined();
  });
});

