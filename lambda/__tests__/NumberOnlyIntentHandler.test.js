const NumberOnlyIntentHandler = require('../handlers/NumberOnlyIntentHandler');

// Mock dependent handlers so we can assert routing without invoking their internal logic
jest.mock('../handlers/ProvideAddQuantityIntentHandler', () => ({ handle: jest.fn(async () => ({ speak: 'provide-add-quantity' })) }));
jest.mock('../handlers/ProvideDeleteQuantityIntentHandler', () => ({ handle: jest.fn(async () => ({ speak: 'provide-delete-quantity' })) }));
jest.mock('../handlers/SelectDeliverySlotIntentHandler', () => ({ handle: jest.fn(async () => ({ speak: 'select-delivery-slot' })) }));
jest.mock('../handlers/SelectPromotionIntentHandler', () => ({ handle: jest.fn(async () => ({ speak: 'select-promotion' })) }));
jest.mock('../handlers/AddCartIntentHandler', () => ({ handle: jest.fn(async () => ({ speak: 'add-cart' })) }));

const ProvideAdd = require('../handlers/ProvideAddQuantityIntentHandler');
const ProvideDelete = require('../handlers/ProvideDeleteQuantityIntentHandler');
const SelectDelivery = require('../handlers/SelectDeliverySlotIntentHandler');
const SelectPromo = require('../handlers/SelectPromotionIntentHandler');
const AddCart = require('../handlers/AddCartIntentHandler');

function makeHandlerInput({ number = '2', lastAction = 'SearchProductIntent', sessionAttrs = {} } = {}) {
  const requestEnvelope = {
    request: {
      type: 'IntentRequest',
      intent: {
        name: 'NumberOnlyIntent',
        slots: number !== undefined ? { Number: { name: 'Number', value: number } } : {}
      }
    }
  };

  const attributesManager = {
    _session: { ...sessionAttrs, lastAction },
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

describe('NumberOnlyIntentHandler routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('routes SearchProductIntent -> AddCartIntentHandler with ItemNumber slot', async () => {
    const hi = makeHandlerInput({ number: '3', lastAction: 'SearchProductIntent', sessionAttrs: { lastSearchResults: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }] } });
    // canHandle should be true
    expect(NumberOnlyIntentHandler.canHandle(hi)).toBe(true);

    const res = await NumberOnlyIntentHandler.handle(hi);

    expect(AddCart.handle).toHaveBeenCalledTimes(1);
    const calledWith = AddCart.handle.mock.calls[0][0];
    expect(calledWith.requestEnvelope.request.intent.name).toBe('AddCartIntent');
    expect(calledWith.requestEnvelope.request.intent.slots.ItemNumber.value).toBe('3');
    // ensure handle returns something from mocked handler
    expect(res).toBeDefined();
    expect(res.speak).toBe('add-cart');
  });

  test('routes AddCartIntent (follow-up) -> ProvideAddQuantityIntentHandler with Quantity slot', async () => {
    const hi = makeHandlerInput({ number: '4', lastAction: 'AddCartIntent', sessionAttrs: { pending: true, pendingData: { kind: 'addQuantity', product: { id: 1 } } } });
    expect(NumberOnlyIntentHandler.canHandle(hi)).toBe(true);
    const res = await NumberOnlyIntentHandler.handle(hi);
    expect(ProvideAdd.handle).toHaveBeenCalledTimes(1);
    const calledWith = ProvideAdd.handle.mock.calls[0][0];
    expect(calledWith.requestEnvelope.request.intent.name).toBe('ProvideAddQuantityIntent');
    expect(calledWith.requestEnvelope.request.intent.slots.Quantity.value).toBe('4');
    expect(res.speak).toBe('provide-add-quantity');
  });

  test('routes DeleteCartIntent -> ProvideDeleteQuantityIntentHandler', async () => {
    const hi = makeHandlerInput({ number: '2', lastAction: 'DeleteCartIntent', sessionAttrs: { pending: true, pendingData: { kind: 'deleteQuantity', productId: 1 } } });
    expect(NumberOnlyIntentHandler.canHandle(hi)).toBe(true);
    const res = await NumberOnlyIntentHandler.handle(hi);
    expect(ProvideDelete.handle).toHaveBeenCalledTimes(1);
    const calledWith = ProvideDelete.handle.mock.calls[0][0];
    expect(calledWith.requestEnvelope.request.intent.name).toBe('ProvideDeleteQuantityIntent');
    expect(calledWith.requestEnvelope.request.intent.slots.Quantity.value).toBe('2');
    expect(res.speak).toBe('provide-delete-quantity');
  });

  test('routes SearchAvailableDeliverySlotIntent -> SelectDeliverySlotIntentHandler', async () => {
    const hi = makeHandlerInput({ number: '1', lastAction: 'SearchAvailableDeliverySlotIntent', sessionAttrs: { availableDeliverySlots: [{ id: 's1', spokenLabel: '午前' }] } });
    expect(NumberOnlyIntentHandler.canHandle(hi)).toBe(true);
    const res = await NumberOnlyIntentHandler.handle(hi);
    expect(SelectDelivery.handle).toHaveBeenCalledTimes(1);
    const calledWith = SelectDelivery.handle.mock.calls[0][0];
    expect(calledWith.requestEnvelope.request.intent.name).toBe('SelectDeliverySlotIntent');
    expect(calledWith.requestEnvelope.request.intent.slots.SlotNumber.value).toBe('1');
    expect(res.speak).toBe('select-delivery-slot');
  });

  test('routes SearchAvailablePromotionIntent -> SelectPromotionIntentHandler', async () => {
    const hi = makeHandlerInput({ number: '1', lastAction: 'SearchAvailablePromotionIntent', sessionAttrs: { availablePromos: [{ id: 'p1', name: 'promo' }] } });
    expect(NumberOnlyIntentHandler.canHandle(hi)).toBe(true);
    const res = await NumberOnlyIntentHandler.handle(hi);
    expect(SelectPromo.handle).toHaveBeenCalledTimes(1);
    const calledWith = SelectPromo.handle.mock.calls[0][0];
    expect(calledWith.requestEnvelope.request.intent.name).toBe('SelectPromotionIntent');
    expect(calledWith.requestEnvelope.request.intent.slots.PromoNumber.value).toBe('1');
    expect(res.speak).toBe('select-promotion');
  });

  test('canHandle false when lastAction missing', () => {
    const hi = makeHandlerInput({ number: '1', sessionAttrs: {} });
    // ensure session attributes do not contain lastAction at all
    hi.attributesManager._session = {};
    // ensure getSessionAttributes returns empty object (avoid default param lastAction)
    hi.attributesManager.getSessionAttributes = () => ({});
    expect(NumberOnlyIntentHandler.canHandle(hi)).toBe(false);
  });

  test('handle catches underlying handler error and returns error speak', async () => {
    // Make AddCart handler throw
    AddCart.handle.mockImplementationOnce(async () => { throw new Error('boom'); });
    const hi = makeHandlerInput({ number: '1', lastAction: 'SearchProductIntent', sessionAttrs: { lastSearchResults: [{ id: 1, name: 'A' }] } });
    const res = await NumberOnlyIntentHandler.handle(hi);
    expect(res).toBeDefined();
    expect(res.speak).toMatch(/処理中にエラー/);
  });
});
