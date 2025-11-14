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

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

module.exports = function runNumberOnlyTests() {
  console.log('Running NumberOnlyIntentHandler tests...');

  // Case 1: lastAction = AddCartIntent, numeric slot present => should route to ProvideAddQuantity handler and return response
  const hi1 = makeHandlerInput({ slotValue: '3', sessionAttrs: { lastAction: 'AddCartIntent', pending: true, pendingData: { kind: 'addQuantity', product: { id: 1, name: 'Tomato', brand: 'JA' } } } });
  const can1 = NumberOnlyIntentHandler.canHandle(hi1);
  assert(can1 === true, 'Expected canHandle true for AddCartIntent follow-up');
  const res1Promise = Promise.resolve(NumberOnlyIntentHandler.handle(hi1));
  return res1Promise.then(res1 => {
    assert(res1 && (res1.speak || res1.reprompt), 'Expected response object from handler for AddCartIntent');

    // Case 2: lastAction invalid -> should not canHandle
    const hi2 = makeHandlerInput({ slotValue: '1', sessionAttrs: { lastAction: 'SomeOtherAction' } });
    const can2 = NumberOnlyIntentHandler.canHandle(hi2);
    assert(can2 === false, 'Expected canHandle false for unsupported lastAction');

    // Case 3: missing slot -> the handler's canHandle will still true (since NumberOnlyIntent), but handle will route and may return a reprompt; ensure no crash
    const hi3 = makeHandlerInput({ slotValue: undefined, sessionAttrs: { lastAction: 'SearchAvailableDeliverySlotIntent', availableDeliverySlots: [{ id: 's1', spokenLabel: '午前' }] } });
    const can3 = NumberOnlyIntentHandler.canHandle(hi3);
    assert(can3 === true, 'Expected canHandle true for delivery slot follow-up');
    return Promise.resolve(NumberOnlyIntentHandler.handle(hi3)).then(res3 => {
      assert(res3 && (res3.speak || res3.reprompt), 'Expected response object for missing slot case');
      console.log('NumberOnlyIntentHandler tests passed');
    });
  });

  // Case 2: lastAction invalid -> should not canHandle
  const hi2 = makeHandlerInput({ slotValue: '1', sessionAttrs: { lastAction: 'SomeOtherAction' } });
  const can2 = NumberOnlyIntentHandler.canHandle(hi2);
  assert(can2 === false, 'Expected canHandle false for unsupported lastAction');

  // Case 3: missing slot -> the handler's canHandle will still true (since NumberOnlyIntent), but handle will route and may return a reprompt; ensure no crash
  const hi3 = makeHandlerInput({ slotValue: undefined, sessionAttrs: { lastAction: 'SearchAvailableDeliverySlotIntent', availableDeliverySlots: [{ id: 's1', spokenLabel: '午前' }] } });
  const can3 = NumberOnlyIntentHandler.canHandle(hi3);
  assert(can3 === true, 'Expected canHandle true for delivery slot follow-up');
  const res3 = NumberOnlyIntentHandler.handle(hi3);
  assert(res3 && (res3.speak || res3.reprompt), 'Expected response object for missing slot case');

  console.log('NumberOnlyIntentHandler tests passed');
};
