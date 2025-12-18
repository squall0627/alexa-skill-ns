// プロモーションサービス
// 日本語: プロモーション（クーポン）管理サービス

const TableHandler = require('../tables/TableHandler');
const promotionsTable = new TableHandler('promotions');

class PromotionService {
  // 指定の注文金額に対して利用可能なプロモーションを返す
  async getAvailablePromotions(orderAmount) {
    const promos = await promotionsTable.readAll();
    if (!Array.isArray(promos)) return [];
    return promos.filter((p) => orderAmount >= (p.orderThreshold || 0));
  }

  // IDでプロモーションを取得
  async getPromotionById(promoId) {
    return await promotionsTable.readById(promoId);
  }
}

module.exports = new PromotionService();
