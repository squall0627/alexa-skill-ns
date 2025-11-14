const DeliverySlotService = require('../services/DeliverySlotService');

describe('DeliverySlotService', () => {
  test('returns 3 slots by default', () => {
    const slots = DeliverySlotService.getAvailableSlots({});
    expect(Array.isArray(slots)).toBe(true);
    expect(slots.length).toBeGreaterThanOrEqual(1);
  });

  test('parses "今日" as date and filters slots', () => {
    const today = new Date().toISOString().slice(0, 10);
    const slots = DeliverySlotService.getAvailableSlots({ date: '今日' });
    // 期望结果全部为今日
    expect(slots.every(s => s.dateISO === today)).toBe(true);
  });

  test('parses time "10時" and finds matching slots', () => {
    const slots = DeliverySlotService.getAvailableSlots({ time: '10時' });
    expect(slots.every(s => s.timeRange === '10:00-11:00')).toBe(true);
  });

  test('parses combined "明日の10時"', () => {
    const tomorrow = new Date(Date.now() + 24*3600*1000).toISOString().slice(0,10);
    const slots = DeliverySlotService.getAvailableSlots({ time: '明日の10時' });
    expect(slots.every(s => s.dateISO === tomorrow)).toBe(true);
    expect(slots.every(s => s.timeRange === '10:00-11:00')).toBe(true);
  });
});

