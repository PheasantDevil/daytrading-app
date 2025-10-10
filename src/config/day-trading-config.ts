/**
 * デイトレード設定
 */
export interface DayTradingConfig {
  // スケジュール設定
  schedule: {
    buyTime: string; // 購入時刻（例: '11:00'）
    sellCheckStart: string; // 売却チェック開始時刻（例: '13:00'）
    sellCheckInterval: number; // 売却チェック間隔（ms）
    forceCloseTime: string; // 強制決済時刻（例: '15:00'）
    timezone: string; // タイムゾーン
  };

  // シグナルソース設定
  signalSources: {
    yahoo: { enabled: boolean; weight: number };
    tradingview: { enabled: boolean; weight: number };
    investing: { enabled: boolean; weight: number };
    finviz: { enabled: boolean; weight: number };
    marketwatch: { enabled: boolean; weight: number };
  };

  // 過半数判定設定
  requiredVoteRatio: {
    [key: number]: number;
  };

  // リスク管理設定
  riskManagement: {
    stopLoss: number; // ストップロス（例: -0.03 = -3%）
    takeProfit: number; // テイクプロフィット（例: 0.05 = +5%）
    maxPositionSize: number; // 最大ポジションサイズ（USD）
    maxDailyTrades: number; // 1日の最大取引数
    emergencyStopLoss: number; // 緊急ストップロス（例: -0.05 = -5%）
  };

  // スクリーニング設定
  screening: {
    minVolume: number; // 最小出来高
    minPrice: number; // 最小価格
    maxPrice: number; // 最大価格
    excludeSectors: string[]; // 除外セクター
    candidateCount: number; // 候補銘柄数
  };

  // 取引設定
  trading: {
    enabled: boolean; // 自動取引の有効/無効
    paperTrading: boolean; // ペーパートレーディングモード
    confirmBeforeTrade: boolean; // 取引前の確認
    maxRetries: number; // 最大リトライ回数
  };

  // 通知設定
  notification: {
    enabled: boolean;
    onBuy: boolean; // 購入時通知
    onSell: boolean; // 売却時通知
    onError: boolean; // エラー時通知
    onDailyReport: boolean; // 日次レポート
  };
}

/**
 * デフォルト設定
 */
export const defaultDayTradingConfig: DayTradingConfig = {
  // スケジュール（米国東部時間想定）
  schedule: {
    buyTime: '11:00', // 11:00 AM
    sellCheckStart: '13:00', // 1:00 PM
    sellCheckInterval: 60000, // 1分ごと
    forceCloseTime: '15:00', // 3:00 PM
    timezone: 'America/New_York',
  },

  // シグナルソース（全て有効、同じ重み）
  signalSources: {
    yahoo: { enabled: true, weight: 1 },
    tradingview: { enabled: true, weight: 1 },
    investing: { enabled: true, weight: 1 },
    finviz: { enabled: true, weight: 1 },
    marketwatch: { enabled: true, weight: 1 },
  },

  // 過半数判定（要求仕様通り）
  requiredVoteRatio: {
    3: 0.67, // 3サイト → 67%以上 = 2サイト以上
    4: 0.75, // 4サイト → 75%以上 = 3サイト以上
    5: 0.8, // 5サイト → 80%以上 = 4サイト以上
    6: 0.67, // 6サイト → 67%以上 = 4サイト以上
  },

  // リスク管理
  riskManagement: {
    stopLoss: -0.03, // -3%でストップロス
    takeProfit: 0.05, // +5%でテイクプロフィット
    maxPositionSize: 10000, // 最大1万ドル
    maxDailyTrades: 1, // 1日1取引
    emergencyStopLoss: -0.05, // -5%で緊急決済
  },

  // スクリーニング
  screening: {
    minVolume: 1000000, // 最小出来高100万株
    minPrice: 10, // 最小$10
    maxPrice: 500, // 最大$500
    excludeSectors: [], // 除外セクターなし
    candidateCount: 10, // 上位10銘柄を候補に
  },

  // 取引設定
  trading: {
    enabled: false, // デフォルトは無効（安全のため）
    paperTrading: true, // ペーパートレーディングモード
    confirmBeforeTrade: true, // 取引前に確認
    maxRetries: 3, // 最大3回リトライ
  },

  // 通知設定
  notification: {
    enabled: true,
    onBuy: true,
    onSell: true,
    onError: true,
    onDailyReport: true,
  },
};

/**
 * 日本時間用の設定
 */
export const japanDayTradingConfig: DayTradingConfig = {
  ...defaultDayTradingConfig,
  schedule: {
    ...defaultDayTradingConfig.schedule,
    buyTime: '09:30', // 9:30 AM JST
    sellCheckStart: '11:30', // 11:30 AM JST
    forceCloseTime: '14:30', // 2:30 PM JST
    timezone: 'Asia/Tokyo',
  },
};

