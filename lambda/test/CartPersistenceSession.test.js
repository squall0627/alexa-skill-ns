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
  return { requestEnvelope, attributesManager, responseBuilder: { speak() { return this; }, reprompt() { return this; }, getResponse() { return {}; } } };
}

describe('Cart persistence for session promo/payment fields', () => {
  test('SelectPromotionIntent marks _cartDirty and buildCartData includes appliedPromo', async () => {
    const attributesManager = mockAttributesManager({}, { availablePromos: [{ id: 'PROMO1', name: '割引', amount: 100 }], lastAction: 'SearchAvailablePromotionIntent', cart: [{ id: 1 }] });
    const hi = makeHandlerInput({ intentName: 'SelectPromotionIntent', attributesManager });
    await SelectPromotionIntentHandler.handle(hi);
    const sa = attributesManager.getSessionAttributes();
    expect(sa._cartDirty).toBe(true);
    const data = CartPersistenceHelper.buildCartData(sa);
    expect(data).toHaveProperty('appliedPromo');
    expect(data.appliedPromo).toMatchObject({ id: 'PROMO1', name: '割引' });
  });

  test('StartPaymentIntent initializes paymentFlow and marks dirty', async () => {
    const attributesManager = mockAttributesManager({}, {});
    const hi = makeHandlerInput({ intentName: 'StartPaymentIntent', attributesManager });
    await StartPaymentIntentHandler.handle(hi);
    const sa = attributesManager.getSessionAttributes();
    expect(sa.paymentFlow).toBeDefined();
    expect(sa._cartDirty).toBe(true);
    const data = CartPersistenceHelper.buildCartData(sa);
    expect(data.paymentFlow).toBeDefined();
    expect(data.paymentFlow.method).toBeNull();
  });

  test('SelectPaymentMethodIntent sets method and marks dirty', async () => {
    const attributesManager = mockAttributesManager({}, { lastAction: 'StartPaymentIntent', cart: [{ id: 1 }] });
    const hi = makeHandlerInput({ intentName: 'SelectPaymentMethodIntent', slots: { PaymentNumber: { value: '2' } }, attributesManager });
    await SelectPaymentMethodIntentHandler.handle(hi);
    const sa = attributesManager.getSessionAttributes();
    expect(sa.paymentFlow).toBeDefined();
    expect(sa.paymentFlow.method).toBe('credit');
    expect(sa._cartDirty).toBe(true);
    const data = CartPersistenceHelper.buildCartData(sa);
    expect(data.paymentFlow.method).toBe('credit');
  });

  test('SpecifyWaonPointsIntent saves points and marks dirty', async () => {
    const attributesManager = mockAttributesManager({ waonBalance: 1000 }, { lastAction: 'SpecifyWaonPointsIntent', paymentFlow: { method: 'aeon' } });
    const hi = makeHandlerInput({ intentName: 'SpecifyWaonPointsIntent', slots: { Number: { value: '123' } }, attributesManager });
    await SpecifyWaonPointsIntentHandler.handle(hi);
    const sa = attributesManager.getSessionAttributes();
    expect(sa.paymentFlow).toBeDefined();
    expect(sa.paymentFlow.waonPoints).toBe(123);
    expect(sa._cartDirty).toBe(true);
    const data = CartPersistenceHelper.buildCartData(sa);
    expect(data.paymentFlow.waonPoints).toBe(123);
  });

  test('PendingConfirmationHandler confirmShareholderCard sets useShareholderCard and marks dirty', async () => {
    const attributesManager = mockAttributesManager({}, { paymentFlow: {}, pending: true, pendingData: { kind: 'confirmShareholderCard' } });
    const hi = makeHandlerInput({ intentName: 'AMAZON.YesIntent', attributesManager });
    await PendingConfirmationHandler.handle(hi);
    const sa = attributesManager.getSessionAttributes();
    expect(sa.paymentFlow).toBeDefined();
    expect(sa.paymentFlow.useShareholderCard).toBe(true);
    expect(sa._cartDirty).toBe(true);
    const data = CartPersistenceHelper.buildCartData(sa);
    expect(data.paymentFlow.useShareholderCard).toBe(true);
  });
});

