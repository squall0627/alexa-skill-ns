// チェックアウトサービス（CheckoutService）
// 日本語: カートの内容と配送料から合計金額を計算するサービス

const TableHandler = require('../tables/TableHandler');
const productsTable = new TableHandler('products');
const PromotionService = require('./PromotionService');

class CheckoutService {
  /**
   * カートと配送料を受け取り、合計金額を計算する
   * cart: [{ id, name, price, promoPrice, quantity }]
   */
  async calculate(cart = [], deliveryFee = 0) {
    const allProducts = await productsTable.readAll();

    // カート明細を正規化して価格を計算
    const items = (cart || []).map((ci) => {
      // ci may contain only id and quantity; find product
      const prod = allProducts.find((p) => p.id === ci.id) || {};
      const quantity = ci.quantity || 1;
      const unitPrice = prod.promoPrice && prod.promoPrice < prod.price ? prod.promoPrice : prod.price || 0;
      const lineTotal = unitPrice * quantity;
      return {
        id: prod.id || ci.id,
        name: prod.name || ci.name,
        unitPrice,
        quantity,
        lineTotal,
        originalPrice: prod.price || ci.price || 0,
        promoPrice: prod.promoPrice || null,
      };
    });

    const itemsTotal = items.reduce((s, it) => s + it.lineTotal, 0);
    const subtotal = itemsTotal + (deliveryFee || 0);

    const availablePromos = await PromotionService.getAvailablePromotions(itemsTotal);

    return {
      items,
      itemsTotal,
      deliveryFee,
      subtotal,
      availablePromos,
    };
  }

  /**
   * 指定のプロモーションを適用して最終金額を返す
   * appliedPromo: { promoId, name, orderThreshold, amount }
   */
  async finalize(cart = [], deliveryFee = 0, appliedPromo = null) {
    const base = await this.calculate(cart, deliveryFee);
    let discount = 0;
    let applied = null;
    if (appliedPromo && appliedPromo.amount) {
      // 利用可能である前提（呼び出し元で検証すること）
      discount = appliedPromo.amount;
      applied = appliedPromo;
    }

    const totalAfterDiscount = Math.max(0, base.subtotal - discount);

    // 日本語の要約文を作成
    const promoMsg = applied ? `クーポン「${applied.name}」を適用し、${discount}円割引されました。` : '';
    const summary = `${promoMsg}合計金額は${totalAfterDiscount}円です（配送料込み）。`;

    return {
      ...base,
      appliedPromo: applied,
      discount,
      totalAfterDiscount,
      summary,
    };
  }
}

module.exports = new CheckoutService();
