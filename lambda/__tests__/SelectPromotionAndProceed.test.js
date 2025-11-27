const SelectPromotionIntentHandler = require('../handlers/SelectPromotionIntentHandler');
const PendingConfirmationHandler = require('../handlers/PendingConfirmationHandler');

// Mock CheckoutService used by SelectPromotionIntentHandler
jest.mock('../services/CheckoutService', () => ({ finalize: jest.fn(async () => ({ summary: '合計1000円' })) }));
// Mock StartPayment handler
jest.mock('../handlers/StartPaymentIntentHandler', () => ({ handle: jest.fn(async () => ({ speak: 'start-payment-speak', reprompt: 'pay-reprompt' })) }));

const StartPayment = require('../handlers/StartPaymentIntentHandler');

function makeHandlerInput({ requestName = 'SelectPromotionIntent', slots = {}, sessionAttrs = {} } = {}) {
  const requestEnvelope = {
    request: {
      type: 'IntentRequest',
      intent: { name: requestName, slots }
    }
  };

  const attributesManager = {
    _session: { ...sessionAttrs },
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

describe('SelectPromotionIntentHandler -> confirmProceedToPayment flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('SelectPromotionIntentHandler applies promo and sets pending confirmProceedToPayment', async () => {
    const hi = makeHandlerInput({
      requestName: 'SelectPromotionIntent',
      slots: { PromoNumber: { name: 'PromoNumber', value: '1' } },
      sessionAttrs: { availablePromos: [{ id: 'p1', name: 'PROMO' }], cart: [], lastAction: 'SearchAvailablePromotionIntent' }
    });

    expect(SelectPromotionIntentHandler.canHandle(hi)).toBe(true);

    const res = await SelectPromotionIntentHandler.handle(hi);

    // session should have pending set
    const sess = hi.attributesManager.getSessionAttributes();
    expect(sess.pending).toBe(true);
    expect(sess.pendingData && sess.pendingData.kind).toBe('confirmProceedToPayment');

    expect(res).toBeDefined();
    expect(res.speak).toContain('PROMOを適用しました');
    expect(res.speak).toContain('お支払いに進みますか');
  });

  test('PendingConfirmationHandler Yes delegates directly to StartPaymentIntentHandler', async () => {
    const hi = makeHandlerInput({ requestName: 'AMAZON.YesIntent', sessionAttrs: { pending: true, pendingData: { kind: 'confirmProceedToPayment' }, lastAction: 'SelectPromotionIntent' } });

    expect(PendingConfirmationHandler.canHandle(hi)).toBe(true);

    const res = await PendingConfirmationHandler.handle(hi);

    expect(StartPayment.handle).toHaveBeenCalledTimes(1);
    // handler should return whatever StartPayment handler returned
    expect(res).toBeDefined();
    expect(res.speak).toBe('start-payment-speak');
    expect(res.reprompt).toBe('pay-reprompt');
  });

  test('PendingConfirmationHandler No asks what to do next', async () => {
    const hi = makeHandlerInput({ requestName: 'AMAZON.NoIntent', sessionAttrs: { pending: true, pendingData: { kind: 'confirmProceedToPayment' }, lastAction: 'SelectPromotionIntent' } });
    expect(PendingConfirmationHandler.canHandle(hi)).toBe(true);

    const res = await PendingConfirmationHandler.handle(hi);
    expect(res).toBeDefined();
    expect(res.speak).toContain('ほかに何をしますか');
  });
});
