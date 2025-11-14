// lambda/utils/parseQuantity.js
// 日本語: ユーザーが話した数量を寛容に解析するユーティリティ

function toHalfWidth(s) {
  return s.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
}

// 簡単な漢数字パーサ（1-99程度をサポート）
const KANJI_NUM = {
  '零': 0, '〇': 0,
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
  '十': 10
};

function parseKanjiNumber(str) {
  // 支持像 "二十" "二十三" "十" "十一" 等
  if (!str || typeof str !== 'string') return NaN;
  let s = str.replace(/[^一二三四五六七八九十〇零]/g, '');
  if (s.length === 0) return NaN;
  let total = 0;
  if (s === '十') return 10;
  if (s.includes('十')) {
    const parts = s.split('十');
    const tens = parts[0] ? (KANJI_NUM[parts[0]] || 0) : 1; // '十' => 10
    const ones = parts[1] ? (KANJI_NUM[parts[1]] || 0) : 0;
    total = tens * 10 + ones;
  } else {
    // 単独漢数字
    total = 0;
    for (const ch of s) {
      total = total * 10 + (KANJI_NUM[ch] || 0);
    }
  }
  return total || NaN;
}

function parseSpokenQuantity(raw) {
  if (!raw || typeof raw !== 'string') return NaN;
  let s = raw.trim();
  s = s.replace(/\s+/g, '');
  s = s.replace(/個|個|つ|こ|本|枚/g, ''); // remove common counters
  s = toHalfWidth(s);

  // try digit extraction
  const m = s.match(/(\d+)/);
  if (m) return parseInt(m[1], 10);

  // try kanji
  const kanjiParsed = parseKanjiNumber(s);
  if (!Number.isNaN(kanjiParsed)) return kanjiParsed;

  return NaN;
}

module.exports = {
  parseSpokenQuantity,
};

