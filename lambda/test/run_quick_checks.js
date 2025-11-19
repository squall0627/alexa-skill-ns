const CartPersistenceHelper = require('../utils/CartPersistenceHelper');
const SelectPromotionIntentHandler = require('../handlers/SelectPromotionIntentHandler');
const StartPaymentIntentHandler = require('../handlers/StartPaymentIntentHandler');
const SelectPaymentMethodIntentHandler = require('../handlers/SelectPaymentMethodIntentHandler');
const SpecifyWaonPointsIntentHandler = require('../handlers/SpecifyWaonPointsIntentHandler');
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
    _getState: () => ({ persistent, session })
  };
}

function makeHandlerInput({ intentName = 'StartPaymentIntent', slots = {}, attributesManager } = {}) {
  const requestEnvelope = {
    request: {
      type: 'IntentRequest',
      intent: {
        name: intentName,
        slots
      }
    }
  };
  if (attributesManager) {
    // ensure session merges
    const sa = attributesManager.getSessionAttributes();
    attributesManager.setSessionAttributes(Object.assign({}, sa));
  }
  return { requestEnvelope, attributesManager, responseBuilder: { speak() { return this; }, reprompt() { return this; }, getResponse() { return {}; } } };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

async function run() {
  console.log('Quick checks starting...');

  // Test 1: buildCartData appliedPromo
  const sa1 = { availablePromos: [{ id: 'PROMO1', name: '割引', amount: 100 }], lastAction: 'SearchAvailablePromotionIntent', cart: [{ id: 1 }] };
  const am1 = mockAttributesManager({}, sa1);
  await SelectPromotionIntentHandler.handle(makeHandlerInput({ intentName: 'SelectPromotionIntent', slots: { PromoNumber: { value: '1' } }, attributesManager: am1 }));
  const s1 = am1.getSessionAttributes();
  assert(s1._cartDirty === true, 'SelectPromotion did not set _cartDirty');
  const d1 = CartPersistenceHelper.buildCartData(s1);
  assert(d1.appliedPromo && d1.appliedPromo.id === 'PROMO1', 'appliedPromo not in buildCartData');

  // Test 2: null vs undefined equality
  const sessionA = { cart: [{ id: 1 }], paymentFlow: { method: undefined } };
  const persistentB = { cart: [{ id: 1 }], paymentFlow: { method: null } };
  const should = CartPersistenceHelper.shouldSave(sessionA, persistentB);
  assert(should === false, 'null vs undefined should be equal (shouldSave false)');

  // Test 3: missing nested field vs null
  const sessionC = { cart: [{ id: 1 }], paymentFlow: {} };
  const persistentD = { cart: [{ id: 1 }], paymentFlow: { waonPoints: null } };
  assert(CartPersistenceHelper.shouldSave(sessionC, persistentD) === false, 'missing nested numeric should equal null');

  // Test 4: StartPayment sets dirty and paymentFlow
  const am2 = mockAttributesManager({}, {});
  await StartPaymentIntentHandler.handle(makeHandlerInput({ intentName: 'StartPaymentIntent', attributesManager: am2 }));
  const s2 = am2.getSessionAttributes();
  assert(s2.paymentFlow && s2._cartDirty === true, 'StartPaymentIntent did not set paymentFlow or _cartDirty');

  // Test 5: SelectPaymentMethod sets method
  const am3 = mockAttributesManager({}, { lastAction: 'StartPaymentIntent', cart: [{ id: 1 }] });
  await SelectPaymentMethodIntentHandler.handle(makeHandlerInput({ intentName: 'SelectPaymentMethodIntent', slots: { PaymentNumber: { value: '2' } }, attributesManager: am3 }));
  const s3 = am3.getSessionAttributes();
  assert(s3.paymentFlow && s3.paymentFlow.method === 'credit', 'SelectPaymentMethod did not set method credit');
  assert(s3._cartDirty === true, 'SelectPaymentMethod did not set _cartDirty');

  // Test 6: Specify Waon points
  const am4 = mockAttributesManager({ waonBalance: 1000 }, { lastAction: 'SpecifyWaonPointsIntent', paymentFlow: { method: 'aeon' } });
  await SpecifyWaonPointsIntentHandler.handle(makeHandlerInput({ intentName: 'SpecifyWaonPointsIntent', slots: { Number: { value: '123' } }, attributesManager: am4 }));
  const s4 = am4.getSessionAttributes();
  assert(s4.paymentFlow && s4.paymentFlow.waonPoints === 123, 'SpecifyWaonPoints did not save waonPoints');
  assert(s4._cartDirty === true, 'SpecifyWaonPoints did not set _cartDirty');

  // Test 7: PendingConfirmation confirmShareholderCard
  const am5 = mockAttributesManager({}, { paymentFlow: {}, pending: true, pendingData: { kind: 'confirmShareholderCard' } });
  await PendingConfirmationHandler.handle(makeHandlerInput({ intentName: 'AMAZON.YesIntent', attributesManager: am5 }));
  const s5 = am5.getSessionAttributes();
  assert(s5.paymentFlow && s5.paymentFlow.useShareholderCard === true, 'PendingConfirmation did not set useShareholderCard');
  assert(s5._cartDirty === true, 'PendingConfirmation did not set _cartDirty for shareholder card');

  console.log('All quick checks passed.');
}

run().catch(err => { console.error('Quick checks failed:', err); process.exit(1); });
