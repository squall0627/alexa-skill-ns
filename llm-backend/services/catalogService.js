// services/catalogService.js
// 日本語：カタログデータと検索ロジックを提供するサービス

// サンプル商品カタログ（実環境では DB/API から取得）
const CATALOG = [
  { id: 'SKU1001', title: '明治 おいしい牛乳 1L', brand: '明治', category: '牛乳', price: 198, rating: 4.6, stock: 50 },
  { id: 'SKU1002', title: '雪印 メグミルク 1L', brand: '雪印', category: '牛乳', price: 188, rating: 4.4, stock: 8 },
  { id: 'SKU1101', title: '森永 E赤ちゃん 粉ミルク 800g', brand: '森永', category: 'ベビー粉ミルク', price: 2480, rating: 4.7, stock: 20 },
  { id: 'SKU1102', title: '明治 ほほえみ 800g', brand: '明治', category: 'ベビー粉ミルク', price: 2550, rating: 4.8, stock: 5 },
  { id: 'SKU2001', title: 'キッコーマン 調製豆乳 1L', brand: 'キッコーマン', category: '豆乳', price: 158, rating: 4.5, stock: 60 },
  { id: 'SKU3001', title: 'サントリー 天然水 2L', brand: 'サントリー', category: '水', price: 98, rating: 4.3, stock: 100 },
  { id: 'SKU4001', title: '日清 カップヌードル 醤油', brand: '日清', category: 'カップ麺', price: 128, rating: 4.2, stock: 200 },
];

/**
 * 簡易検索/フィルタ
 */
function searchCatalog({ query, category, brand }) {
  const q = (query || '').toLowerCase();
  return CATALOG.filter(p => (
    (!category || p.category.includes(category)) &&
    (!brand || p.brand.includes(brand)) &&
    (!q || p.title.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
  ));
}

function getById(id) {
  return CATALOG.find(p => p.id === id);
}

module.exports = { CATALOG, searchCatalog, getById };
