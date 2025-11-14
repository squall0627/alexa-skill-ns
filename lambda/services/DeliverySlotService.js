let DateTime;
try {
  DateTime = require('luxon').DateTime;
} catch (e) {
  // luxon not available (e.g., npm install was not run). Provide a minimal fallback.
  DateTime = {
    now() { return new LocalDateTime(new Date()); },
    fromFormat(str, fmt) { return LocalDateTime.fromFormat(str); }
  };

  function LocalDateTime(d) {
    this._date = d instanceof Date ? d : new Date(d);
  }
  LocalDateTime.prototype.plus = function (opts) {
    const d = new Date(this._date);
    if (opts && opts.days) d.setDate(d.getDate() + opts.days);
    return new LocalDateTime(d);
  };
  LocalDateTime.prototype.toISODate = function () {
    const y = this._date.getFullYear();
    const m = String(this._date.getMonth() + 1).padStart(2, '0');
    const d = String(this._date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  LocalDateTime.prototype.toFormat = function (fmt) {
    // support 'M/d' and 'yyyy-LL-dd'
    if (fmt === 'M/d') {
      return `${this._date.getMonth() + 1}/${this._date.getDate()}`;
    }
    if (fmt === 'yyyy-LL-dd') {
      const y = this._date.getFullYear();
      const m = String(this._date.getMonth() + 1).padStart(2, '0');
      const d = String(this._date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return this._date.toString();
  };
  LocalDateTime.prototype.toISO = function () { return this._date.toISOString(); };

  LocalDateTime.fromFormat = function (s) {
    // parse formats like "yyyy-LL-dd'T'HH:mm" or "yyyyLLdd"
    if (s.includes('T')) {
      const parts = s.split('T');
      return new LocalDateTime(new Date(parts[0]));
    }
    if (/^\d{8}$/.test(s)) {
      const y = s.slice(0,4), m = s.slice(4,6), d = s.slice(6,8);
      return new LocalDateTime(new Date(`${y}-${m}-${d}T00:00:00Z`));
    }
    return new LocalDateTime(new Date(s));
  };
}

class DeliverySlotService {
  /**
   * 解析用: 日本語のあいまいな日付表現を処理（今日/明日/明後日 など）
   */
  _parseDateInput(dateStr) {
    if (!dateStr) return null;
    const now = DateTime.now();
    const s = String(dateStr).trim();

    // 日本語の単語
    if (s === '今日' || s === 'きょう') return now.toISODate();
    if (s === '明日' || s === 'あした' || s === 'あす') return now.plus({ days: 1 }).toISODate();
    if (s === '明後日' || s === 'あさって') return now.plus({ days: 2 }).toISODate();

    // 形式: YYYY-MM-DD（Alexa の AMAZON.DATE として渡される標準形式）
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return s;

    // 形式: YYYYMMDD
    const compactMatch = s.match(/^(\d{8})$/);
    if (compactMatch) {
      return DateTime.fromFormat(s, 'yyyyLLdd').toISODate();
    }

    // 形式: '2025-11-14T10:00' のような日時
    const dtMatch = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    if (dtMatch) return dtMatch[1];

    // その他: 週や月の指定などは今はサポートしていない
    return null;
  }

  /**
   * 解析用: 日本語の時間表現を標準の timeRange に変換（例: '10時' -> '10:00-11:00'）
   */
  _parseTimeInput(timeStr) {
    if (!timeStr) return null;
    const s = String(timeStr).trim();

    // 典型的なレンジ: '10:00-11:00'
    const rangeMatch = s.match(/^(\d{1,2}:?\d{0,2})\s*[-〜〜~to]+\s*(\d{1,2}:?\d{0,2})$/u);
    if (rangeMatch) {
      const start = rangeMatch[1].includes(':') ? rangeMatch[1] : `${String(rangeMatch[1]).padStart(2, '0')}:00`;
      const end = rangeMatch[2].includes(':') ? rangeMatch[2] : `${String(rangeMatch[2]).padStart(2, '0')}:00`;
      return `${start}-${end}`.replace(/\s+/g, '');
    }

    // 時のみ指定: '10時'、'10時に' -> 10:00-11:00
    const hourMatch = s.match(/^(?:午前|午後)?\s*(\d{1,2})時/);
    if (hourMatch) {
      let hour = parseInt(hourMatch[1], 10);
      // 午後が含まれる場合に補正する (簡易: 午後に '午後' が含まれると 12 時加える。現状は日本語の '午後' をキャッチしない可能性あり)
      if (/午後/.test(s) && hour < 12) hour = (hour % 12) + 12;
      const start = `${String(hour).padStart(2, '0')}:00`;
      const end = `${String(hour + 1).padStart(2, '0')}:00`;
      return `${start}-${end}`;
    }

    // 形式 '10:00' 単独 -> 10:00-11:00
    const timeOnlyMatch = s.match(/^(\d{1,2}):(\d{2})$/);
    if (timeOnlyMatch) {
      const hour = parseInt(timeOnlyMatch[1], 10);
      const start = `${String(hour).padStart(2, '0')}:${timeOnlyMatch[2]}`;
      const endHour = hour + 1;
      const end = `${String(endHour).padStart(2, '0')}:00`;
      return `${start}-${end}`;
    }

    // 未解釈
    return null;
  }

  /**
   * 利用可能な配達スロットを取得する
   * @param {Object} opts
   * @param {string} [opts.date] - ISO 8601 日付文字列（YYYY-MM-DD）またはAlexaのAMAZON.DATE出力や日本語のあいまい表現（今日、明日など）
   * @param {string} [opts.time] - 時刻（HH:MM）や時間帯の文字列（例: "10:00-11:00"）や日本語のあいまい表現（"10時"、"明日の10時"）
   * @param {number} [opts.limit=3] - 返す最大スロット数
   * @returns {Array} 配列のスロットオブジェクト（id, dateLabel, timeRange, fee, isoStart, isoEnd）
   */
  getAvailableSlots(opts = {}) {
    const { date, time, limit = 3 } = opts;

    // 使用する基準日時はシステムの現在時刻
    const now = DateTime.now();

    // ここでは簡易的に今日から7日分、各日に 10:00-11:00 と 11:00-12:00 の2枠を生成
    const baseSlots = [];
    const patterns = [
      { timeRange: '10:00-11:00', fees: [300, 200, 200, 200, 200, 200, 200] },
      { timeRange: '11:00-12:00', fees: [0, 100, 100, 100, 100, 100, 100] }
    ];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const d = now.plus({ days: dayOffset });
      const dateLabel = d.toFormat('M/d');
      patterns.forEach((p) => {
        const [startStr, endStr] = p.timeRange.split('-');
        const start = DateTime.fromFormat(`${d.toFormat('yyyy-LL-dd')}T${startStr}`, "yyyy-LL-dd'T'HH:mm");
        const end = DateTime.fromFormat(`${d.toFormat('yyyy-LL-dd')}T${endStr}`, "yyyy-LL-dd'T'HH:mm");
        const fee = (p.fees && p.fees[Math.min(dayOffset, p.fees.length - 1)]) || 0;
        baseSlots.push({
          id: `${d.toISODate()}_${p.timeRange}`,
          dateISO: d.toISODate(),
          dateLabel: dateLabel,
          timeRange: p.timeRange,
          fee: fee,
          isoStart: start.toISO(),
          isoEnd: end.toISO()
        });
      });
    }

    // ソート
    baseSlots.sort((a, b) => (a.dateISO === b.dateISO ? a.timeRange.localeCompare(b.timeRange) : a.dateISO.localeCompare(b.dateISO)));

    // 解析: date/time が日本語のあいまい表現であれば内部で解釈
    let parsedDate = this._parseDateInput(date);
    let parsedTime = this._parseTimeInput(time);

    // time 参数可能に '明日の10時' のように date と time を含む場合の処理
    if (time && typeof time === 'string') {
      const m = String(time).match(/^(?:([^\s]+)の)?\s*(.*)$/);
      if (m) {
        const maybeDate = m[1];
        const maybeTime = m[2];
        if (maybeDate) {
          const pd = this._parseDateInput(maybeDate);
          if (pd) parsedDate = pd; // override
        }
        if (maybeTime) {
          const pt = this._parseTimeInput(maybeTime);
          if (pt) parsedTime = pt;
        }
      }
    }

    // フィルタ
    let filtered = baseSlots;
    if (parsedDate) {
      filtered = filtered.filter((s) => s.dateISO === parsedDate);
    }
    if (parsedTime) {
      filtered = filtered.filter((s) => s.timeRange === parsedTime);
    }

    const result = filtered.slice(0, limit);

    return result.map((s) => ({ id: s.id, dateLabel: s.dateLabel, dateISO: s.dateISO, timeRange: s.timeRange, fee: s.fee, spokenLabel: `${s.dateLabel}、${s.timeRange}、配送費${s.fee === 0 ? '無料' : s.fee + '円'}` }));
  }
}

module.exports = new DeliverySlotService();
