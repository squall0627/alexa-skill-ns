// lambda/tables/TableHandler.js
// 非同期のファイルベース「テーブル」ハンドラ（Promise/async対応）
// readAll, readById, query, create, update, delete を async で提供

const fs = require('fs').promises;
const path = require('path');

async function loadTable(tableName) {
  const filePath = path.join(__dirname, `${tableName}.json`);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[TableHandler] テーブル ${tableName} の読み込みに失敗しました:`, e.message);
    return [];
  }
}

async function writeTable(tableName, data) {
  const filePath = path.join(__dirname, `${tableName}.json`);
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error(`[TableHandler] テーブル ${tableName} の書き込みに失敗しました:`, e.message);
    return false;
  }
}

class TableHandler {
  constructor(tableName) {
    this.tableName = tableName;
  }

  // 全件取得（最新のファイル内容を反映して返す）
  async readAll() {
    return await loadTable(this.tableName);
  }

  // IDで取得。レコードに id または promoId のどちらかが存在する可能性を考慮
  async readById(id) {
    const data = await loadTable(this.tableName);
    return data.find((r) => r.id === id || r.promoId === id) || null;
  }

  // 条件に一致するものを返す（filterFn を受け取る）
  async query(filterFn) {
    const data = await loadTable(this.tableName);
    return data.filter(filterFn);
  }

  // 作成 - 新しいレコードを追加してファイルに書き込む
  async create(record) {
    const data = await loadTable(this.tableName);
    data.push(record);
    await writeTable(this.tableName, data);
    return record;
  }

  // 更新 - id/key で見つけてマージ
  async update(id, patch) {
    const data = await loadTable(this.tableName);
    const idx = data.findIndex((r) => r.id === id || r.promoId === id);
    if (idx === -1) return null;
    data[idx] = { ...data[idx], ...patch };
    await writeTable(this.tableName, data);
    return data[idx];
  }

  // 削除 - id/key で削除
  async delete(id) {
    const data = await loadTable(this.tableName);
    const idx = data.findIndex((r) => r.id === id || r.promoId === id);
    if (idx === -1) return false;
    data.splice(idx, 1);
    await writeTable(this.tableName, data);
    return true;
  }
}

module.exports = TableHandler;
