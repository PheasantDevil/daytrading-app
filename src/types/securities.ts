// 証券口座関連の型定義

export interface SecuritiesAccount {
  id: number;
  userId: number;
  brokerName: string;
  accountNumber: string;
  username: string;
  isActive: boolean;
  deviceRegistered: boolean;
  lastConnected: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSecuritiesAccountRequest {
  brokerName: string;
  accountNumber: string;
  apiPassword: string; // kabuステーションAPI用
  username: string;
  password: string;
}

export interface UpdateSecuritiesAccountRequest {
  brokerName?: string;
  accountNumber?: string;
  apiPassword?: string; // kabuステーションAPI用
  username?: string;
  password?: string;
  isActive?: boolean;
}

export interface SecuritiesAccountResponse {
  success: boolean;
  data?: SecuritiesAccount;
  message?: string;
}

export interface SecuritiesAccountsResponse {
  success: boolean;
  data?: SecuritiesAccount[];
  message?: string;
}

// kabuステーションAPI用の型定義
export interface KabuApiCredentials {
  apiPassword: string; // APIパスワード
  userId: string; // ユーザーID
  password: string; // ログインパスワード
}

export interface KabuApiResponse<T = any> {
  IsOK: boolean;
  Code: number;
  Message: string;
  data?: T;
}

export interface KabuAccountInfo {
  AccountType: number;
  AccountTypeName: string;
  DelivType: number;
  DelivTypeName: string;
  ExpireDay: number;
  MarginTradeType: number;
  MarginTradeTypeName: string;
  NextDelivDay: number;
  StockAccountType: number;
  StockAccountTypeName: string;
}

export interface KabuPosition {
  HoldID: string;
  Qty: number;
  StockCode: string;
  StockName: string;
  StockPrice: number;
  StockPriceUnit: number;
  TargetPrice: number;
  TargetPriceUnit: number;
  ValCmp: number;
  ValCmpUnit: number;
  ValLoss: number;
  ValLossUnit: number;
}

export interface KabuOrderRequest {
  Password: string;
  Symbol: string;
  Exchange: number;
  SecurityType: number;
  Side: string; // '1': 売, '2': 買
  CashMargin: number;
  MarginTradeType?: number;
  DelivType: number;
  FundType: string;
  AccountType: number;
  Qty: number;
  Price?: number;
  ExpireDay?: number;
  FrontOrderType: number;
}
