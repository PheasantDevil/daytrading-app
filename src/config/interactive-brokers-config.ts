export interface InteractiveBrokersConfig {
  name: string;
  host: string;
  port: number;
  clientId: number;
  accountId: string;
  timeout: number;
  retryAttempts: number;
  paperTrading: boolean;
}

export const ibConfig: InteractiveBrokersConfig = {
  name: 'interactive_brokers',
  host: process.env.IB_HOST || '127.0.0.1',
  port: parseInt(process.env.IB_PORT || '7497'), // 7497=paper trading, 7496=live trading
  clientId: parseInt(process.env.IB_CLIENT_ID || '1'),
  accountId: process.env.IB_ACCOUNT_ID || '',
  timeout: 30000,
  retryAttempts: 3,
  paperTrading: process.env.IB_PAPER_TRADING === 'true',
};

export const ibAutoTradingConfig = {
  enabled: true,
  tradingHours: {
    start: '09:30', // US market open (EST)
    end: '16:00', // US market close (EST)
    timezone: 'America/New_York',
  },
  strategies: {
    momentum: {
      enabled: true,
      weight: 0.5,
      riskLevel: 'medium' as const,
      maxPositions: 10,
      stopLoss: 0.02,
      takeProfit: 0.04,
    },
    meanReversion: {
      enabled: true,
      weight: 0.3,
      riskLevel: 'low' as const,
      maxPositions: 5,
      stopLoss: 0.015,
      takeProfit: 0.03,
    },
    breakout: {
      enabled: true,
      weight: 0.2,
      riskLevel: 'high' as const,
      maxPositions: 3,
      stopLoss: 0.025,
      takeProfit: 0.05,
    },
  },
  riskManagement: {
    maxDailyLoss: 1000, // USD
    maxPositionSize: 10000, // USD
    maxPortfolioRisk: 0.1,
    emergencyStop: true,
  },
  monitoring: {
    checkInterval: 5000,
    alertThresholds: {
      loss: 500,
      drawdown: 0.05,
      volatility: 0.1,
    },
  },
  broker: {
    name: 'interactive_brokers',
    apiKey: '', // Not used for IB (uses TWS/Gateway connection)
    accountId: process.env.IB_ACCOUNT_ID || '',
    sandbox: process.env.IB_PAPER_TRADING === 'true',
  },
  markets: {
    us: { enabled: true, exchanges: ['NYSE', 'NASDAQ', 'AMEX'] },
    japan: { enabled: true, exchanges: ['TSE', 'OSE'] },
    europe: { enabled: false, exchanges: ['LSE', 'XETRA'] },
    asia: { enabled: false, exchanges: ['HKEX', 'SGX'] },
  },
};
