import { EventEmitter } from 'events';

interface MarketDataSubscription {
  symbol: string;
  callback: (data: MarketData) => void;
  interval: number;
}

interface MarketData {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: Date;
  high24h: number;
  low24h: number;
  change24h: number;
  changePercent24h: number;
}

interface RealtimeDataStreamConfig {
  host: string;
  port: number;
  clientId: number;
  reconnectInterval: number;
  maxReconnectAttempts: number;
}

/**
 * リアルタイムデータストリームサービス
 * WebSocketを使用してInteractive Brokersからリアルタイムデータを取得
 */
export class RealtimeDataStream extends EventEmitter {
  private config: RealtimeDataStreamConfig;
  private subscriptions: Map<string, MarketDataSubscription> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private dataUpdateTimer?: NodeJS.Timeout;

  constructor(config: RealtimeDataStreamConfig) {
    super();
    this.config = config;
  }

  /**
   * WebSocket接続を開始
   */
  async connect(): Promise<void> {
    try {
      console.log(`Connecting to IB Gateway at ${this.config.host}:${this.config.port}`);
      
      // モック実装: 実際のWebSocket接続の代わりにタイマーを使用
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // ハートビート開始
      this.startHeartbeat();
      
      // データ更新開始
      this.startDataUpdates();
      
      this.emit('connected');
      console.log('Connected to IB Gateway (mock implementation)');
      
    } catch (error) {
      console.error('Failed to connect to IB Gateway:', error);
      this.handleConnectionError();
      throw error;
    }
  }

  /**
   * WebSocket接続を切断
   */
  async disconnect(): Promise<void> {
    try {
      console.log('Disconnecting from IB Gateway...');
      
      this.isConnected = false;
      
      // タイマーをクリア
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = undefined;
      }
      
      if (this.dataUpdateTimer) {
        clearInterval(this.dataUpdateTimer);
        this.dataUpdateTimer = undefined;
      }
      
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
      }
      
      // サブスクリプションをクリア
      this.subscriptions.clear();
      
      this.emit('disconnected');
      console.log('Disconnected from IB Gateway');
      
    } catch (error) {
      console.error('Error during disconnect:', error);
      throw error;
    }
  }

  /**
   * 市場データのサブスクリプションを開始
   */
  subscribe(symbol: string, callback: (data: MarketData) => void, interval: number = 5000): void {
    if (!this.isConnected) {
      throw new Error('Not connected to IB Gateway');
    }

    const subscription: MarketDataSubscription = {
      symbol,
      callback,
      interval,
    };

    this.subscriptions.set(symbol, subscription);
    console.log(`Subscribed to market data for ${symbol}`);
    
    this.emit('subscribed', symbol);
  }

  /**
   * 市場データのサブスクリプションを停止
   */
  unsubscribe(symbol: string): void {
    if (this.subscriptions.has(symbol)) {
      this.subscriptions.delete(symbol);
      console.log(`Unsubscribed from market data for ${symbol}`);
      this.emit('unsubscribed', symbol);
    }
  }

  /**
   * 複数銘柄のサブスクリプションを一括開始
   */
  subscribeMultiple(symbols: string[], callback: (data: MarketData[]) => void, interval: number = 5000): void {
    symbols.forEach(symbol => {
      this.subscribe(symbol, (data) => {
        // 全銘柄のデータが揃ったらコールバックを呼び出し
        const allData = Array.from(this.subscriptions.values())
          .map(sub => this.generateMockMarketData(sub.symbol))
          .filter(data => symbols.includes(data.symbol));
        
        if (allData.length === symbols.length) {
          callback(allData);
        }
      }, interval);
    });
  }

  /**
   * 接続状態を取得
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * アクティブなサブスクリプション数を取得
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * ハートビートを開始
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.emit('heartbeat');
        console.log('Heartbeat sent');
      }
    }, 30000); // 30秒間隔
  }

  /**
   * データ更新を開始
   */
  private startDataUpdates(): void {
    this.dataUpdateTimer = setInterval(() => {
      if (this.isConnected && this.subscriptions.size > 0) {
        this.updateMarketData();
      }
    }, 1000); // 1秒間隔でデータ更新
  }

  /**
   * 市場データを更新
   */
  private updateMarketData(): void {
    this.subscriptions.forEach((subscription) => {
      try {
        const marketData = this.generateMockMarketData(subscription.symbol);
        subscription.callback(marketData);
      } catch (error) {
        console.error(`Error updating market data for ${subscription.symbol}:`, error);
      }
    });
  }

  /**
   * モック市場データを生成
   */
  private generateMockMarketData(symbol: string): MarketData {
    const basePrice = 100 + Math.random() * 200;
    const change = (Math.random() - 0.5) * 10;
    const changePercent = (change / basePrice) * 100;

    return {
      symbol,
      price: basePrice,
      bid: basePrice - 0.05,
      ask: basePrice + 0.05,
      volume: Math.floor(Math.random() * 1000000),
      timestamp: new Date(),
      high24h: basePrice + Math.random() * 5,
      low24h: basePrice - Math.random() * 5,
      change24h: change,
      changePercent24h: changePercent,
    };
  }

  /**
   * 接続エラーを処理
   */
  private handleConnectionError(): void {
    this.isConnected = false;
    
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.config.reconnectInterval * this.reconnectAttempts;
      
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
      
      this.reconnectTimer = setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
    }
  }

  /**
   * 接続状態の監視
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    connected: boolean;
    subscriptions: number;
    timestamp: string;
  }> {
    return {
      healthy: this.isConnected,
      connected: this.isConnected,
      subscriptions: this.subscriptions.size,
      timestamp: new Date().toISOString(),
    };
  }
}

// シングルトンインスタンス
let realtimeDataStream: RealtimeDataStream | null = null;

export function getRealtimeDataStream(config?: RealtimeDataStreamConfig): RealtimeDataStream {
  if (!realtimeDataStream && config) {
    realtimeDataStream = new RealtimeDataStream(config);
  }
  
  if (!realtimeDataStream) {
    throw new Error('RealtimeDataStream not initialized. Call with config first.');
  }
  
  return realtimeDataStream;
}
