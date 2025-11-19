// lambda/services/PaymentService.js
// 支払い関連の簡易サービス（テスト用のスタブ実装）

const CheckoutService = require('./CheckoutService');

class PaymentService {
  constructor() {
    // 初期ポイント残高（新しいユーザー向けのデフォルト）
    this.defaultWaonBalance = 1000;
  }

  // 取得可能な支払い方法一覧（番号 -> id/label）
  getPaymentMethods() {
    return [
      { id: 'cash', label: '現金' },
      { id: 'credit', label: 'クレジットカード' },
      { id: 'aeon', label: 'イオンペイ' }
    ];
  }

  // WAONポイント残高を返す（attributesManager の persistentAttributes を参照）
  async getWaonBalance(attributesManager) {
    if (!attributesManager) return this.defaultWaonBalance;
    const persistent = await attributesManager.getPersistentAttributes() || {};
    if (typeof persistent.waonBalance === 'number') {
      return persistent.waonBalance;
    }
    // 初回はデフォルトをセットして永続化
    persistent.waonBalance = this.defaultWaonBalance;
    attributesManager.setPersistentAttributes(persistent);
    await attributesManager.savePersistentAttributes();
    return persistent.waonBalance;
  }

  // 残高チェック
  async validateWaonPoints(attributesManager, points) {
    const balance = await this.getWaonBalance(attributesManager);
    if (!Number.isInteger(points) || points < 0) return { ok: false, reason: 'invalid', balance };
    if (points > balance) return { ok: false, reason: 'insufficient', balance };
    return { ok: true, balance };
  }

  // 計算ロジック：CheckoutService を使って合計を出し、ポイント適用後の金額を返す
  async computeFinalAmounts(attributesManager, sessionAttributes) {
    const cart = sessionAttributes.cart || [];
    const deliveryFee = (sessionAttributes.cartDelivery && sessionAttributes.cartDelivery.fee) || 0;
    const appliedPromo = sessionAttributes.appliedPromo || null;

    const base = await CheckoutService.finalize(cart, deliveryFee, appliedPromo);

    // WAONポイントが使われているか
    const paymentFlow = sessionAttributes.paymentFlow || {};
    const waonUse = paymentFlow.useWaon;
    const waonPoints = paymentFlow.waonPoints || 0;

    const totalBefore = base.totalAfterDiscount || base.subtotal || 0;
    const afterPoints = Math.max(0, totalBefore - (waonUse ? waonPoints : 0));

    // 返点数の計算ロジック: 200円で1点
    const rewardPoints = Math.floor(afterPoints / 200);

    return {
      ...base,
      totalBefore,
      waonPointsUsed: waonUse ? waonPoints : 0,
      totalAfterPoints: afterPoints,
      rewardPoints,
      summary: `最終の支払金額は${afterPoints}円、今回の返点は${rewardPoints}点です。`
    };
  }

  // 模擬的に支払い処理を実行（成功時はWAONポイントを差し引いて永続化）
  async createPayment(attributesManager, sessionAttributes) {
    const result = await this.computeFinalAmounts(attributesManager, sessionAttributes);

    // WAONポイントの差し引き
    const waonUsed = result.waonPointsUsed || 0;
    if (attributesManager && waonUsed > 0) {
      const persistent = await attributesManager.getPersistentAttributes() || {};
      const current = typeof persistent.waonBalance === 'number' ? persistent.waonBalance : this.defaultWaonBalance;
      persistent.waonBalance = Math.max(0, current - waonUsed);
      attributesManager.setPersistentAttributes(persistent);
      await attributesManager.savePersistentAttributes();
    }

    // mark as paid in session
    sessionAttributes.lastPaymentResult = {
      success: true,
      paidAmount: result.totalAfterPoints,
      rewardPoints: result.rewardPoints
    };

    return { success: true, ...result };
  }
}

module.exports = new PaymentService();
