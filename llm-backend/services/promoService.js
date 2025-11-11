// services/promoService.js
// 日本語：プロモーション/クーポン関連のデータ提供

const PROMOS = [
  { id: 'P10MILK', title: '牛乳カテゴリ 10%オフ クーポン', category: '牛乳', discountPct: 10 },
  { id: 'P200YEN', title: '2,000円以上で200円オフ', minTotal: 2000, discountYen: 200 },
];

function getByCode(code) {
  return PROMOS.find(p => p.id === code);
}

function listAll() {
  return PROMOS.slice();
}

module.exports = { PROMOS, getByCode, listAll };
