// services/SearchProductService.js
// 日本語: 商品検索サービス - 検索ロジックと仮の商品データベース

const TableHandler = require('../tables/TableHandler');
const productsTable = new TableHandler('products');

/**
 * 商品検索サービス
 * ProductQuery（商品名）、Brand（ブランド）、Category（カテゴリ）で検索可能
 */
class SearchProductService {
  /**
   * 商品を検索する
   * @param {Object} filters - 検索フィルター
   * @param {string} filters.productQuery - 商品名（部分一致）
   * @param {string} filters.brand - ブランド名（完全一致）
   * @param {string} filters.category - カテゴリー（完全一致）
   * @param {number} filters.limit - 返す最大商品数（デフォルト 5）
   * @param {number} filters.offset - オフセット（ページネーション）
   * @returns {Object} 検索結果とセッション情報
   */
  async search(filters = {}) {
    const { productQuery, brand, category, limit = 3, offset = 0 } = filters;

    console.log(`[SearchProductService] search() called with:`, {
      productQuery,
      brand,
      category,
      limit,
      offset,
    });

    // フィルタリングロジック
    const allProducts = await productsTable.readAll();
    let results = allProducts.filter((product) => {
      // ProductQuery（商品名）による検索（大文字小文字を区別しない、部分一致）
      if (productQuery && productQuery.trim()) {
        const query = productQuery.toLowerCase();
        if (!product.name.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Brand（ブランド）による検索（完全一致）
      if (brand && brand.trim()) {
        if (product.brand !== brand) {
          return false;
        }
      }

      // Category（カテゴリ）による検索（完全一致）
      if (category && category.trim()) {
        if (product.category !== category) {
          return false;
        }
      }

      // 在庫ありのみ
      return product.availability;


    });

    console.log(`[SearchProductService] Found ${results.length} matching products`);

    // ページネーション
    const total = results.length;
    const pageSize = limit;
    const currentPage = Math.floor(offset / pageSize) + 1;
    const totalPages = Math.ceil(total / pageSize);
    const paginatedResults = results.slice(offset, offset + limit);

    // 日本語の検索結果メッセージを生成
    const spokenResponse = this._generateSpokenResponse(
      paginatedResults,
      { productQuery, brand, category },
      currentPage,
      totalPages,
      limit
    );

    // レスポンスオブジェクト
    const response = {
       spokenResponse,
       reprompt: 'ほかに検索したいことはありますか？',
       shouldEndSession: false,
       products: paginatedResults,
       pagination: {
         total,
         limit,
         offset,
         currentPage,
         totalPages,
         hasNext: offset + limit < total,
       },
       sessionAttributes: {
         lastSearchQuery: { productQuery, brand, category },
         lastSearchResults: paginatedResults,
         currentPage,
       },
     };

    return response;
  }

  /**
   * 検索結果から日本語の音声応答を生成
   * @private
   */
  _generateSpokenResponse(results, filters, currentPage, totalPages, limit) {
    const { productQuery, brand, category } = filters;

    if (results.length === 0) {
      // 検索条件に合致する商品がない場合
      const conditions = [];
      if (productQuery && productQuery.trim()) conditions.push(`「${productQuery}」`);
      if (brand && brand.trim()) conditions.push(`ブランド「${brand}」`);
      if (category && category.trim()) conditions.push(`カテゴリー「${category}」`);

      const conditionStr =
        conditions.length > 0
          ? `${conditions.join('と')}にマッチする`
          : '';

      return `申し訳ありません。${conditionStr}商品は見つかりませんでした。別の検索条件をお試しください。`;
    }

    // 検索結果がある場合
    // results は既に paginatedResults（slice済み）なので、そのまま使用
    const productStrings = results
      .map((p, i) => {
        const base = `番号${i + 1}、${p.name}、価格は${p.price}円`;
        if (p.promoPrice && p.promoPrice < p.price) {
          // セールを強調
          return `${base}、現在セール中！特別価格は${p.promoPrice}円です。おすすめです。`;
        }
        return base;
      })
      .join('。 ');

    const condition = productQuery || brand || category ? '検索結果：' : '';

    // 商品を提示した後、ユーザーに番号で選んでもらうプロンプトを追加
    const askForSelection = results.length > 0 ? '。 どの商品をカートに入れますか？ 番号で教えてください。' : '';

    return `${condition}${productStrings}${
      results.length > 0 && totalPages > 1 ? `。 次のページもありますか？` : ''
    } ${askForSelection}`.trim();
  }

  /**
   * 全カテゴリーの一覧を取得
   * @returns {Array} カテゴリー名の配列
   */
  async getCategories() {
    const allProducts = await productsTable.readAll();
    const categories = [...new Set(allProducts.map((p) => p.category))];
    return categories;
  }

  /**
   * 全ブランドの一覧を取得
   * @returns {Array} ブランド名の配列
   */
  async getBrands() {
    const allProducts = await productsTable.readAll();
    const brands = [...new Set(allProducts.map((p) => p.brand))];
    return brands;
  }
}

module.exports = new SearchProductService();
