// filepath: lambda/test/PaymentFlow.test.js
// Lightweight end-to-end simulation of the payment flow without external test frameworks.
const StartPaymentIntentHandler = require('../handlers/StartPaymentIntentHandler');
const NumberOnlyIntentHandler = require('../handlers/NumberOnlyIntentHandler');
const PendingConfirmationHandler = require('../handlers/PendingConfirmationHandler');

function mockAttributesManager(initialPersistent = {}, initialSession = {}) {
  let persistent = { ...initialPersistent };
  let session = { ...initialSession };
  return {
    getSessionAttributes: () => session,
    setSessionAttributes: (s) => { session = s; },
    getPersistentAttributes: async () => persistent,
    setPersistentAttributes: (p) => { persistent = p; },
    savePersistentAttributes: async () => {},
    // expose for assertions
    _getState: () => ({ persistent, session })
  };
}

function makeHandlerInput({ intentName = 'StartPaymentIntent', slots = {}, attributesManager, sessionAttrs = {} } = {}) {
  const requestEnvelope = {
    request: {
      type: 'IntentRequest',
      intent: {
        name: intentName,
        slots
      }
    }
  };

  if (attributesManager && sessionAttrs) {
    const sa = attributesManager.getSessionAttributes();
    attributesManager.setSessionAttributes(Object.assign({}, sa, sessionAttrs));
  }

  const responseBuilder = {
    _spoken: null,
    _reprompt: null,
    speak(text) { this._spoken = text; return this; },
    reprompt(text) { this._reprompt = text; return this; },
    getResponse() { return { spoken: this._spoken, reprompt: this._reprompt }; }
  };

  return { requestEnvelope, attributesManager, responseBuilder };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function getSpeak(resp) {
  return resp && (resp.speak || resp.spoken || resp);
}

async function runPaymentFlowTests() {
  console.log('Running Payment Flow tests...');

  // Setup: user has 500 WAON points in persistent storage, and a cart with product id 1
  const attributesManager = mockAttributesManager({ waonBalance: 500, cartData: { cart: [{ id: 1, quantity: 1 }] } }, { cart: [{ id: 1, quantity: 1 }], cartDelivery: { fee: 0 }, appliedPromo: null });

  // 1) StartPaymentIntent (user says '支払いに進む') -> Ask payment methods
  const hi1 = makeHandlerInput({ intentName: 'StartPaymentIntent', attributesManager });
  const res1 = await StartPaymentIntentHandler.handle(hi1);
  const s1 = getSpeak(res1);
  assert(s1, 'StartPaymentIntent did not respond');
  console.log('StartPaymentIntent:', s1.substring(0, 80));

  // Simulate user picks AEON which is index 3 (methods: cash(1), credit(2), aeon(3))
  // Use NumberOnlyIntent routing: set lastAction to StartPaymentIntent (already set by handler)
  const sessionAfterStart = attributesManager.getSessionAttributes();
  assert(sessionAfterStart.lastAction === 'StartPaymentIntent', 'lastAction not set to StartPaymentIntent');

  const hi2 = makeHandlerInput({ intentName: 'NumberOnlyIntent', slots: { Number: { name: 'Number', value: '3' } }, attributesManager });
  const res2 = await NumberOnlyIntentHandler.handle(hi2);
  console.log('SelectPaymentMethod response:', getSpeak(res2) || '---');

  // After selecting AEON, pending should be set to confirmUseWaon
  const sa2 = attributesManager.getSessionAttributes();
  assert(sa2.pending === true && sa2.pendingData && sa2.pendingData.kind === 'confirmUseWaon', 'confirmUseWaon pending not set');

  // 2) User answers Yes to using WAON
  const hi3 = makeHandlerInput({ intentName: 'AMAZON.YesIntent', attributesManager });
  const res3 = await PendingConfirmationHandler.handle(hi3);
  console.log('ConfirmUseWaon response:', getSpeak(res3));
  // After yes, lastAction should be 'SpecifyWaonPointsIntent'
  const sa3 = attributesManager.getSessionAttributes();
  assert(sa3.lastAction === 'SpecifyWaonPointsIntent', 'lastAction not updated to SpecifyWaonPointsIntent');

  // 3) User specifies points: 100
  const hi4 = makeHandlerInput({ intentName: 'NumberOnlyIntent', slots: { Number: { name: 'Number', value: '100' } }, attributesManager });
  const res4 = await NumberOnlyIntentHandler.handle(hi4);
  console.log('SpecifyWaonPoints response:', getSpeak(res4));
  const sa4 = attributesManager.getSessionAttributes();
  assert(sa4.paymentFlow && sa4.paymentFlow.waonPoints === 100, 'waonPoints not saved');

  // After specifying points, pending should be confirmShareholderCard
  assert(sa4.pending === true && sa4.pendingData && sa4.pendingData.kind === 'confirmShareholderCard', 'confirmShareholderCard not pending');

  // 4) User answers No to shareholder card
  const hi5 = makeHandlerInput({ intentName: 'AMAZON.NoIntent', attributesManager });
  const res5 = await PendingConfirmationHandler.handle(hi5);
  console.log('ConfirmShareholderCard (No) response (should be order summary):', getSpeak(res5));

  // After summary, a pending confirmFinalizePayment should be set
  const sa5 = attributesManager.getSessionAttributes();
  assert(sa5.pending === true && sa5.pendingData && sa5.pendingData.kind === 'confirmFinalizePayment', 'confirmFinalizePayment pending not set');

  // 5) User answers Yes to final confirmation -> payment occurs and finalizeOrderSuccess should clear session and persistent cart
  const hi6 = makeHandlerInput({ intentName: 'AMAZON.YesIntent', attributesManager });
  const res6 = await PendingConfirmationHandler.handle(hi6);
  console.log('Final confirmation response:', getSpeak(res6));

  // Check persistent waonBalance decreased by 100
  const persistentAfter = await attributesManager.getPersistentAttributes();
  assert(typeof persistentAfter.waonBalance === 'number', 'waonBalance missing');
  assert(persistentAfter.waonBalance === 400, `waonBalance expected 400 but got ${persistentAfter.waonBalance}`);

  // Check persistent cartData cleared
  assert(!persistentAfter.cartData, 'persistent cartData should be cleared after finalize');

  // Check session cart cleared
  const sessionFinal = attributesManager.getSessionAttributes();
  assert(!sessionFinal.cart, 'session cart should be cleared after finalize');

  console.log('Payment Flow tests PASSED');
}

module.exports = runPaymentFlowTests;

// If run directly, execute
if (require.main === module) {
  runPaymentFlowTests().catch(err => { console.error('Payment Flow tests FAILED:', err); process.exit(1); });
}
