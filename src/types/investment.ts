// 投資商品の種類
export type InvestmentProductType =
  | 'STOCK' // 株式
  | 'ETF' // 上場投資信託
  | 'MUTUAL_FUND' // 投資信託
  | 'GOLD' // 金
  | 'BOND' // 債券
  | 'CRYPTO' // 暗号資産
  | 'COMMODITY'; // 商品先物

// 投資商品の基本情報
export interface InvestmentProduct {
  id: string;
  symbol: string;
  name: string;
  type: InvestmentProductType;
  currentPrice: number;
  currency: string;
  minOrderSize: number;
  tradingFee: number; // 取引手数料（固定）
  tradingFeeRate: number; // 取引手数料率（%）
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 投資ポジション
export interface InvestmentPosition {
  id: string;
  productId: string;
  product: InvestmentProduct;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  totalCost: number; // 取得総額（手数料込み）
  currentValue: number; // 現在評価額
  unrealizedPnl: number; // 未実現損益
  unrealizedPnlPercent: number;
  createdAt: Date;
  updatedAt: Date;
}

// 取引履歴
export interface InvestmentTransaction {
  id: string;
  productId: string;
  product: InvestmentProduct;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fee: number; // 手数料
  totalAmount: number; // 総額（手数料込み）
  reason: string; // 取引理由
  confidence: number; // 信頼度
  createdAt: Date;
}

// エージェントの判断記録
export interface AgentDecision {
  id: string;
  agentId: string;
  productId: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  reason: string;
  analysis: {
    technical: string; // 技術分析の結果
    risk: string; // リスク評価
    market: string; // 市場環境
    confidence: number; // 信頼度
  };
  expectedReturn: number; // 期待リターン
  stopLoss: number; // ストップロス価格
  takeProfit: number; // 利確価格
  createdAt: Date;
}

// エージェントの設定
export interface AgentConfig {
  id: string;
  name: string;
  version: string;
  minConfidence: number; // 最小信頼度
  maxPositionSize: number; // 最大ポジションサイズ
  stopLossPercent: number; // ストップロス率
  takeProfitPercent: number; // 利確率
  maxDailyTrades: number; // 1日の最大取引数
  riskTolerance: 'LOW' | 'MEDIUM' | 'HIGH';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 取引戦略の設定
export interface TradingStrategy {
  id: string;
  name: string;
  description: string;
  buyConditions: string[]; // 買い条件
  sellConditions: string[]; // 売り条件
  riskManagement: {
    maxDrawdown: number; // 最大ドローダウン
    positionSizing: string; // ポジションサイジング方法
    diversification: number; // 分散投資率
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
