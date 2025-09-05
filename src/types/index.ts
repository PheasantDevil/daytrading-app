// ユーザー関連の型定義
export interface User {
  id: number;
  email: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// 銘柄関連の型定義
export interface Stock {
  id: number;
  symbol: string;
  name: string;
  market: string;
  sector?: string;
  created_at: Date;
  updated_at: Date;
}

// 株価データの型定義
export interface StockPrice {
  id: number;
  stock_id: number;
  price: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  close?: number;
  timestamp: Date;
  created_at: Date;
}

// 取引関連の型定義
export interface Trade {
  id: number;
  user_id: number;
  stock_id: number;
  trade_type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  total_amount: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  created_at: Date;
  updated_at: Date;
}

export interface CreateTradeRequest {
  stock_id: number;
  trade_type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
}

// ポジション関連の型定義
export interface Position {
  id: number;
  user_id: number;
  stock_id: number;
  quantity: number;
  average_price: number;
  total_investment: number;
  created_at: Date;
  updated_at: Date;
}

// 予測関連の型定義
export interface Prediction {
  id: number;
  stock_id: number;
  predicted_price: number;
  confidence_score?: number;
  model_name?: string;
  prediction_date: Date;
  created_at: Date;
}

// API レスポンスの型定義
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 認証関連の型定義
export interface AuthToken {
  token: string;
  expires_in: string;
  user: User;
}

// チャートデータの型定義
export interface ChartData {
  timestamp: Date;
  price: number;
  volume?: number;
}

// ダッシュボードデータの型定義
export interface DashboardData {
  total_portfolio_value: number;
  daily_pnl: number;
  total_pnl: number;
  positions: Position[];
  recent_trades: Trade[];
  market_overview: StockPrice[];
}
