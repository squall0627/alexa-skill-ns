const PendingConfirmationHandler = require('../handlers/PendingConfirmationHandler');

// Mock dependent handlers
jest.mock('../handlers/SearchAvailablePromotionIntentHandler', () => ({ handle: jest.fn(async () => ({ speak: 'promo-speak' })) }));
jest.mock('../handlers/StartPaymentIntentHandler', () => ({ handle: jest.fn(async () => ({ speak: 'start-payment-speak', reprompt: 'pay-reprompt' })) }));

const SearchPromo = require('../handlers/SearchAvailablePromotionIntentHandler');
const StartPayment = require('../handlers/StartPaymentIntentHandler');

function makeHandlerInput({ intentName = 'AMAZON.YesIntent', sessionAttrs = {} } = {}) {
  const requestEnvelope = {
    request: {
      type: 'IntentRequest',
      intent: { name: intentName }
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

describe('PendingConfirmationHandler promotion -> payment transition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Yes to confirmCheckPromotions delegates to SearchAvailablePromotionIntentHandler', async () => {
    const hi = makeHandlerInput({ intentName: 'AMAZON.YesIntent', sessionAttrs: { pending: true, pendingData: { kind: 'confirmCheckPromotions' } } });
    expect(PendingConfirmationHandler.canHandle(hi)).toBe(true);

    const res = await PendingConfirmationHandler.handle(hi);

    expect(SearchPromo.handle).toHaveBeenCalledTimes(1);
    expect(res).toBeDefined();
    expect(res.speak).toBe('promo-speak');
  });

  test('No to confirmCheckPromotions plays transition then delegates to StartPaymentIntentHandler', async () => {
    const hi = makeHandlerInput({ intentName: 'AMAZON.NoIntent', sessionAttrs: { pending: true, pendingData: { kind: 'confirmCheckPromotions' } } });
    expect(PendingConfirmationHandler.canHandle(hi)).toBe(true);

    const res = await PendingConfirmationHandler.handle(hi);

    expect(StartPayment.handle).toHaveBeenCalledTimes(1);
    expect(res).toBeDefined();
    expect(res.speak).toContain('开始结算');
    expect(res.speak).toContain('start-payment-speak');
    expect(res.reprompt).toBe('pay-reprompt');
  });
});
