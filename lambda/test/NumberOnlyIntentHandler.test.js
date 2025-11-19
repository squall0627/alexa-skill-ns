// lambda/test/NumberOnlyIntentHandler.test.js
const NumberOnlyIntentHandler = require('../handlers/NumberOnlyIntentHandler');

function makeHandlerInput({ intentName = 'NumberOnlyIntent', slotValue = '2', sessionAttrs = {} } = {}) {
  const requestEnvelope = {
    request: {
      type: 'IntentRequest',
      intent: {
        name: intentName,
        slots: slotValue !== undefined ? { Number: { name: 'Number', value: slotValue } } : {}
      }
    }
  };

  const attributesManager = {
    _session: Object.assign({}, sessionAttrs),
    getSessionAttributes() { return this._session; },
    setSessionAttributes(attrs) { this._session = attrs; }
  };

  const built = {};
  const responseBuilder = {
    speak(text) { built.speak = text; return this; },
    reprompt(text) { built.reprompt = text; return this; },
    getResponse() { return built; }
  };

  return { requestEnvelope, attributesManager, responseBuilder };
}

describe('NumberOnlyIntentHandler', () => {
  test('routes for AddCartIntent and other follow-ups without crashing', async () => {
    // Case: lastAction = AddCartIntent -> should be handled
    const hi1 = makeHandlerInput({ slotValue: '3', sessionAttrs: { lastAction: 'AddCartIntent', pending: true, pendingData: { kind: 'addQuantity', product: { id: 1, name: 'Tomato' } } } });
    expect(NumberOnlyIntentHandler.canHandle(hi1)).toBe(true);
    const res1 = await NumberOnlyIntentHandler.handle(hi1);
    expect(res1).toBeDefined();

    // Case: unsupported lastAction -> canHandle false
    const hi2 = makeHandlerInput({ slotValue: '1', sessionAttrs: { lastAction: 'SomeOtherAction' } });
    expect(NumberOnlyIntentHandler.canHandle(hi2)).toBe(false);

    // Case: missing slot value but valid lastAction (delivery slot) -> handler should still return a response object
    const hi3 = makeHandlerInput({ slotValue: undefined, sessionAttrs: { lastAction: 'SearchAvailableDeliverySlotIntent', availableDeliverySlots: [{ id: 's1', spokenLabel: '午前' }] } });
    expect(NumberOnlyIntentHandler.canHandle(hi3)).toBe(true);
    const res3 = await NumberOnlyIntentHandler.handle(hi3);
    expect(res3).toBeDefined();
  });
});
