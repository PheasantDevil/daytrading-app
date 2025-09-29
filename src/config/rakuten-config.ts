export interface RakutenConfig {
  name: string;
  appId: string;
  appSecret: string;
  accessToken: string;
  refreshToken: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  tradingPassword: string;
  tradingPin: string;
  maxTradingAmount: number;
}

export const rakutenConfig: RakutenConfig = {
  name: 'rakuten',
  appId: process.env.RAKUTEN_APP_ID || '',
  appSecret: process.env.RAKUTEN_APP_SECRET || '',
  accessToken: process.env.RAKUTEN_ACCESS_TOKEN || '',
  refreshToken: process.env.RAKUTEN_REFRESH_TOKEN || '',
  accountNumber: process.env.RAKUTEN_ACCOUNT_NUMBER || '',
  branchCode: process.env.RAKUTEN_BRANCH_CODE || '',
  accountType: process.env.RAKUTEN_ACCOUNT_TYPE || '普通',
  baseUrl: 'https://api.rakuten-sec.co.jp',
  timeout: 30000,
  retryAttempts: 3,
  tradingPassword: process.env.TRADING_PASSWORD || '',
  tradingPin: process.env.TRADING_PIN || '',
  maxTradingAmount: parseInt(process.env.MAX_TRADING_AMOUNT || '1000000'),
};

export const rakutenAutoTradingConfig = {
  enabled: true,
  tradingHours: {
    start: '09:00',
    end: '15:00',
    timezone: 'Asia/Tokyo',
  },
  strategies: {
    momentum: {
      enabled: true,
      weight: 0.5,
      riskLevel: 'medium',
      maxPositions: 5,
      stopLoss: 0.02,
      takeProfit: 0.04,
    },
    meanReversion: {
      enabled: true,
      weight: 0.3,
      riskLevel: 'low',
      maxPositions: 3,
      stopLoss: 0.015,
      takeProfit: 0.03,
    },
    breakout: {
      enabled: true,
      weight: 0.2,
      riskLevel: 'high',
      maxPositions: 2,
      stopLoss: 0.025,
      takeProfit: 0.05,
    },
  },
  riskManagement: {
    maxDailyLoss: 10000, // 1万円
    maxPositionSize: 100000, // 10万円
    maxPortfolioRisk: 0.1,
    emergencyStop: true,
  },
  monitoring: {
    checkInterval: 5000,
    alertThresholds: {
      loss: 5000,
      drawdown: 0.05,
      volatility: 0.1,
    },
  },
  broker: {
    name: 'rakuten',
    apiKey: process.env.RAKUTEN_APP_ID || '',
    accountId: process.env.RAKUTEN_ACCOUNT_NUMBER || '',
    sandbox: false, // 本番環境
  },
};
