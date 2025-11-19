// ...existing code...
// lambda/services/DeliveryAddressService.js
// 配送先管理の簡易サービス（テスト用のダミーJSONデータを返す）

const addresses = [
  {
    id: 'addr_1',
    spokenLabel: '自宅、東京都千代田区丸の内１−１',
    displayLabel: '自宅（東京都千代田区丸の内１−１）',
    isDefault: true
  },
  {
    id: 'addr_2',
    spokenLabel: '勤務先、東京都渋谷区渋谷２−２',
    displayLabel: '勤務先（東京都渋谷区渋谷２−２）',
    isDefault: false
  },
  {
    id: 'addr_3',
    spokenLabel: '実家、北海道札幌市中央区３−３',
    displayLabel: '実家（北海道札幌市中央区３−３）',
    isDefault: false
  }
];

module.exports = {
  // 列挙する（将来的に attributesManager から読み出せるように拡張可能）
  async listAddresses() {
    // ここではダミーの配列を返す
    return addresses;
  },

  // 1-based index
  async getAddressByIndex(attributesManager, index) {
    const i = Number(index) - 1;
    if (!Number.isInteger(i) || i < 0 || i >= addresses.length) return null;
    return addresses[i];
  }
};

// ...existing code...
