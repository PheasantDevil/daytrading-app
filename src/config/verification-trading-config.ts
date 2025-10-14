import { DayTradingConfig } from './day-trading-config';

/**
 * 4日間検証用の設定
 * 複数パターンをテストするための設定
 */

// パターン1: 保守的設定（低リスク）
export const conservativeConfig: DayTradingConfig = {
  schedule: {
    buyTime: '10:30', // 市場が落ち着いた頃
    sellCheckStart: '12:30',
    sellCheckInterval: 120000, // 2分ごと
    forceCloseTime: '15:30',
    timezone: 'America/New_York',
  },
  signalSources: {
    yahoo: { enabled: true, weight: 1 },
    tradingview: { enabled: false, weight: 0 },
    investing: { enabled: false, weight: 0 },
    finviz: { enabled: false, weight: 0 },
    marketwatch: { enabled: false, weight: 0 },
  },
  requiredVoteRatio: { 1: 1.0 }, // 1ソースのみ
  riskManagement: {
    stopLoss: -0.02, // -2% (保守的)
    takeProfit: 0.03, // +3% (控えめ)
    maxPositionSize: 5000,
    maxDailyTrades: 1,
    emergencyStopLoss: -0.03,
  },
  screening: {
    minVolume: 5000000, // 500万株以上（流動性重視）
    minPrice: 20,
    maxPrice: 200,
    excludeSectors: ['Energy', 'Materials'], // ボラティリティの高いセクターを除外
    candidateCount: 5,
  },
  trading: {
    enabled: true,
    paperTrading: true,
    confirmBeforeTrade: false, // 自動実行
    maxRetries: 3,
  },
  notification: {
    enabled: true,
    onBuy: true,
    onSell: true,
    onError: true,
    onDailyReport: true,
  },
};

// パターン2: 標準設定（バランス型）
export const standardConfig: DayTradingConfig = {
  ...conservativeConfig,
  schedule: {
    ...conservativeConfig.schedule,
    buyTime: '11:00',
  },
  riskManagement: {
    stopLoss: -0.03, // -3%
    takeProfit: 0.05, // +5%
    maxPositionSize: 10000,
    maxDailyTrades: 1,
    emergencyStopLoss: -0.05,
  },
};

// パターン3: 積極的設定（高リスク・高リターン）
export const aggressiveConfig: DayTradingConfig = {
  ...conservativeConfig,
  schedule: {
    ...conservativeConfig.schedule,
    buyTime: '09:45', // 市場オープン直後
    sellCheckInterval: 60000, // 1分ごと
  },
  riskManagement: {
    stopLoss: -0.05, // -5%
    takeProfit: 0.08, // +8%
    maxPositionSize: 15000,
    maxDailyTrades: 2,
    emergencyStopLoss: -0.08,
  },
  screening: {
    minVolume: 2000000,
    minPrice: 10,
    maxPrice: 300,
    excludeSectors: [],
    candidateCount: 10,
  },
};

/**
 * 日付別設定マッピング
 */
export const dailyConfigMap: {
  [key: string]: { config: DayTradingConfig; name: string };
} = {
  '2025-10-14': { config: conservativeConfig, name: '保守的' },
  '2025-10-15': { config: conservativeConfig, name: '保守的' },
  '2025-10-16': { config: standardConfig, name: '標準' },
  '2025-10-17': { config: aggressiveConfig, name: '積極的' },
  '2025-10-18': { config: standardConfig, name: '標準（再検証）' },
};

/**
 * 今日の設定を取得
 */
export function getTodayConfig(): { config: DayTradingConfig; name: string } {
  const today = new Date().toISOString().split('T')[0];
  const configData = dailyConfigMap[today];

  if (!configData) {
    throw new Error(
      `今日(${today})の設定が見つかりません。設定可能な日付: ${Object.keys(dailyConfigMap).join(', ')}`
    );
  }

  return configData;
}
