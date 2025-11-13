// services/SearchProductService.js
// 日本語: 商品検索サービス - 検索ロジックと仮の商品データベース

/**
 * 仮商品データベース
 * 実際の商品情報（名前、ブランド、カテゴリ、説明など）
 */
const PRODUCTS_DATABASE = [
  {
    id: 1,
    name: 'トマト',
    brand: 'JA農協',
    category: '野菜',
    description: '新鮮な国産トマト。ビタミンC豊富。',
    price: 200,
    availability: true,
  },
  {
    id: 2,
    name: 'ミニトマト',
    brand: 'JA農協',
    category: '野菜',
    description: '甘いミニトマト。サラダに最適。',
    price: 150,
    availability: true,
  },
  {
    id: 3,
    name: 'りんご',
    brand: 'ふじリンゴ農園',
    category: '果物',
    description: '甘くて脆いふじリンゴ。',
    price: 300,
    availability: true,
  },
  {
    id: 4,
    name: 'みかん',
    brand: 'みかん農家組合',
    category: '果物',
    description: 'ビタミンCたっぷりのみかん。',
    price: 250,
    availability: true,
  },
  {
    id: 5,
    name: 'ぶどう',
    brand: 'ぶどう農園',
    category: '果物',
    description: 'シャインマスカット。甘くて大粒。',
    price: 800,
    availability: true,
  },
  {
    id: 6,
    name: 'レタス',
    brand: 'JA農協',
    category: '野菜',
    description: 'シャキシャキのレタス。',
    price: 180,
    availability: true,
  },
  {
    id: 7,
    name: 'キャベツ',
    brand: 'JA農協',
    category: '野菜',
    description: '甘いキャベツ。お鍋や炒め物に。',
    price: 150,
    availability: true,
  },
  {
    id: 8,
    name: 'にんじん',
    brand: 'JA農協',
    category: '野菜',
    description: '甘い国産人参。',
    price: 100,
    availability: true,
  },
  {
    id: 9,
    name: 'バナナ',
    brand: 'フィリピン産',
    category: '果物',
    description: '黄色く熟したバナナ。栄養豊富。',
    price: 120,
    availability: true,
  },
  {
    id: 10,
    name: 'いちご',
    brand: 'いちご農園',
    category: '果物',
    description: 'あまおう。甘くて大粒。',
    price: 600,
    availability: true,
  },
];

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
  search(filters = {}) {
    const { productQuery, brand, category, limit = 3, offset = 0 } = filters;

    console.log(`[SearchProductService] search() called with:`, {
      productQuery,
      brand,
      category,
      limit,
      offset,
    });

    // フィルタリングロジック
    let results = PRODUCTS_DATABASE.filter((product) => {
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
      if (!product.availability) {
        return false;
      }

      return true;
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
      totalPages
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
  _generateSpokenResponse(results, filters, currentPage, totalPages) {
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
    // 音声用に先頭 limit 件を番号付きで生成（1-based index）
    const topResults = results.slice(0, limit);
    const productStrings = topResults
      .map((p, i) => `番号${i + 1}、${p.name}、価格は${p.price}円`)
      .join('。 ');

    const pageInfo =
      totalPages > 1
        ? `（全${totalPages}ページ中${currentPage}ページ目。 `
        : '';

    const condition = productQuery || brand || category ? '検索結果：' : '';

    // 商品を提示した後、ユーザーに番号で選んでもらうプロンプトを追加
    const askForSelection = topResults.length > 0 ? 'どの商品をカートに入れますか？ 番号で教えてください。' : '';

    return `${condition}${productStrings}${
      totalPages > 1 ? `。 次のページもありますか？` : ''
    } ${askForSelection}`.trim();
  }

  /**
   * 全カテゴリーの一覧を取得
   * @returns {Array} カテゴリー名の配列
   */
  getCategories() {
    const categories = [...new Set(PRODUCTS_DATABASE.map((p) => p.category))];
    return categories;
  }

  /**
   * 全ブランドの一覧を取得
   * @returns {Array} ブランド名の配列
   */
  getBrands() {
    const brands = [...new Set(PRODUCTS_DATABASE.map((p) => p.brand))];
    return brands;
  }
}

module.exports = new SearchProductService();
