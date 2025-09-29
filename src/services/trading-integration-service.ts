/**
 * 取引統合サービス
 * OANDA Japan（FX）とウィブル証券（米国株）の統合管理
 */

import { OandaIntegrationService, OandaOrder, OandaPosition, OandaPrice } from './oanda-integration';
import { WebullIntegrationService, WebullOrder, WebullPosition, WebullQuote } from './webull-integration';

export interface UnifiedOrder {
  id: string;
  symbol: string;
  market: 'FX' | 'US';
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  type: 'LIMIT' | 'MARKET' | 'STOP' | 'STOP_LIMIT';
  status: 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  createTime: Date;
  fillTime?: Date;
  filledQuantity: number;
  filledPrice?: number;
  broker: 'OANDA' | 'WEBULL';
}

export interface UnifiedPosition {
  symbol: string;
  market: 'FX' | 'US';
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPl: number;
  unrealizedPlPercent: number;
  broker: 'OANDA' | 'WEBULL';
}

export interface UnifiedQuote {
  symbol: string;
  market: 'FX' | 'US';
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  close: number;
  timestamp: Date;
  broker: 'OANDA' | 'WEBULL';
}

export interface TradingConfig {
  oanda: {
    apiKey: string;
    accountId: string;
    environment: 'sandbox' | 'live';
    baseUrl: string;
  };
  webull: {
    apiKey: string;
    secretKey: string;
    baseUrl: string;
    environment: 'sandbox' | 'live';
  };
  autoReconnect: boolean;
  reconnectInterval: number; // ミリ秒
  maxRetries: number;
}

export class TradingIntegrationService {
  private config: TradingConfig;
  private oandaService: OandaIntegrationService;
  private webullService: WebullIntegrationService;
  private isConnected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;

  constructor(config: TradingConfig) {
    this.config = config;
    this.oandaService = new OandaIntegrationService(config.oanda);
    this.webullService = new WebullIntegrationService(config.webull);
  }

  /**
   * 接続を初期化
   */
  async initialize(): Promise<boolean> {
    console.log('🔄 取引統合サービス初期化中...');

    try {
      // OANDA接続テスト
      const oandaConnected = await this.oandaService.testConnection();
      console.log(`OANDA接続: ${oandaConnected ? '✅' : '❌'}`);

      // ウィブル接続テスト
      const webullConnected = await this.webullService.testConnection();
      console.log(`ウィブル接続: ${webullConnected ? '✅' : '❌'}`);

      this.isConnected = oandaConnected || webullConnected;

      if (this.config.autoReconnect && !this.isConnected) {
        this.startReconnectTimer();
      }

      console.log(`取引統合サービス初期化: ${this.isConnected ? '✅' : '❌'}`);
      return this.isConnected;
    } catch (error) {
      console.error('取引統合サービス初期化エラー:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * 注文を発注
   */
  async placeOrder(order: {
    symbol: string;
    market: 'FX' | 'US';
    side: 'BUY' | 'SELL';
    quantity: number;
    price?: number;
    type: 'LIMIT' | 'MARKET' | 'STOP' | 'STOP_LIMIT';
    stopPrice?: number;
  }): Promise<UnifiedOrder | null> {
    try {
      if (order.market === 'FX') {
        const oandaOrder = await this.oandaService.placeOrder({
          instrument: order.symbol,
          units: order.quantity,
          side: order.side.toLowerCase() as 'buy' | 'sell',
          type: order.type as 'MARKET' | 'LIMIT' | 'STOP',
          price: order.price,
          stopLossPrice: order.stopPrice,
        });

        if (oandaOrder) {
          return this.convertOandaOrderToUnified(oandaOrder);
        }
      } else if (order.market === 'US') {
        const webullOrder = await this.webullService.placeOrder({
          symbol: order.symbol,
          side: order.side,
          quantity: order.quantity,
          price: order.price,
          type: order.type as 'LIMIT' | 'MARKET' | 'STOP' | 'STOP_LIMIT',
          stopPrice: order.stopPrice,
        });

        if (webullOrder) {
          return this.convertWebullOrderToUnified(webullOrder);
        }
      }

      return null;
    } catch (error) {
      console.error('注文発注エラー:', error);
      return null;
    }
  }

  /**
   * 注文をキャンセル
   */
  async cancelOrder(orderId: string, broker: 'OANDA' | 'WEBULL'): Promise<boolean> {
    try {
      if (broker === 'OANDA') {
        return await this.oandaService.cancelOrder(orderId);
      } else if (broker === 'WEBULL') {
        return await this.webullService.cancelOrder(orderId);
      }
      return false;
    } catch (error) {
      console.error('注文キャンセルエラー:', error);
      return false;
    }
  }

  /**
   * 全ポジションを取得
   */
  async getAllPositions(): Promise<UnifiedPosition[]> {
    const positions: UnifiedPosition[] = [];

    try {
      // OANDAポジション取得
      const oandaPositions = await this.oandaService.getPositions();
      for (const position of oandaPositions) {
        positions.push(this.convertOandaPositionToUnified(position));
      }

      // ウィブルポジション取得
      const webullPositions = await this.webullService.getPositions();
      for (const position of webullPositions) {
        positions.push(this.convertWebullPositionToUnified(position));
      }

      return positions;
    } catch (error) {
      console.error('ポジション取得エラー:', error);
      return positions;
    }
  }

  /**
   * 全注文履歴を取得
   */
  async getAllOrders(): Promise<UnifiedOrder[]> {
    const orders: UnifiedOrder[] = [];

    try {
      // OANDA注文取得
      const oandaOrders = await this.oandaService.getOrders();
      for (const order of oandaOrders) {
        orders.push(this.convertOandaOrderToUnified(order));
      }

      // ウィブル注文取得
      const webullOrders = await this.webullService.getOrders();
      for (const order of webullOrders) {
        orders.push(this.convertWebullOrderToUnified(order));
      }

      return orders.sort((a, b) => b.createTime.getTime() - a.createTime.getTime());
    } catch (error) {
      console.error('注文履歴取得エラー:', error);
      return orders;
    }
  }

  /**
   * 現在価格を取得
   */
  async getCurrentPrice(symbol: string, market: 'FX' | 'US'): Promise<UnifiedQuote | null> {
    try {
      if (market === 'FX') {
        const oandaPrice = await this.oandaService.getCurrentPrice(symbol);
        if (oandaPrice) {
          return this.convertOandaPriceToUnified(oandaPrice);
        }
      } else if (market === 'US') {
        const webullQuote = await this.webullService.getCurrentPrice(symbol);
        if (webullQuote) {
          return this.convertWebullQuoteToUnified(webullQuote);
        }
      }
      return null;
    } catch (error) {
      console.error('現在価格取得エラー:', error);
      return null;
    }
  }

  /**
   * 複数銘柄の価格を一括取得
   */
  async getMultiplePrices(
    symbols: Array<{ symbol: string; market: 'FX' | 'US' }>
  ): Promise<Map<string, UnifiedQuote>> {
    const results = new Map<string, UnifiedQuote>();

    const promises = symbols.map(async ({ symbol, market }) => {
      try {
        const quote = await this.getCurrentPrice(symbol, market);
        if (quote) {
          results.set(symbol, quote);
        }
      } catch (error) {
        console.error(`${symbol} 価格取得エラー:`, error);
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * リアルタイム価格ストリームを開始
   */
  async startPriceStream(
    symbols: Array<{ symbol: string; market: 'FX' | 'US' }>,
    callback: (quote: UnifiedQuote) => void
  ): Promise<void> {
    const fxSymbols = symbols.filter(s => s.market === 'FX').map(s => s.symbol);
    const usSymbols = symbols.filter(s => s.market === 'US').map(s => s.symbol);

    const promises = [];

    if (fxSymbols.length > 0) {
      promises.push(
        this.oandaService.startPriceStream(fxSymbols, (price) => {
          callback(this.convertOandaPriceToUnified(price));
        })
      );
    }

    if (usSymbols.length > 0) {
      promises.push(
        this.webullService.startPriceStream(usSymbols, (quote) => {
          callback(this.convertWebullQuoteToUnified(quote));
        })
      );
    }

    await Promise.allSettled(promises);
  }

  /**
   * 接続状態をチェック
   */
  async checkConnectionStatus(): Promise<{
    oanda: boolean;
    webull: boolean;
    overall: boolean;
  }> {
    const oandaConnected = await this.oandaService.testConnection();
    const webullConnected = await this.webullService.testConnection();
    const overall = oandaConnected || webullConnected;

    this.isConnected = overall;

    return {
      oanda: oandaConnected,
      webull: webullConnected,
      overall,
    };
  }

  /**
   * 再接続タイマーを開始
   */
  private startReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
    }

    this.reconnectTimer = setInterval(async () => {
      if (this.reconnectAttempts >= this.config.maxRetries) {
        console.log('❌ 最大再接続試行回数に達しました');
        if (this.reconnectTimer) {
          clearInterval(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        return;
      }

      this.reconnectAttempts++;
      console.log(`🔄 再接続試行中... (${this.reconnectAttempts}/${this.config.maxRetries})`);
      
      const connected = await this.initialize();
      if (connected) {
        console.log('✅ 再接続成功');
        this.reconnectAttempts = 0;
        if (this.reconnectTimer) {
          clearInterval(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      }
    }, this.config.reconnectInterval);
  }

  /**
   * OANDA注文を統一形式に変換
   */
  private convertOandaOrderToUnified(order: OandaOrder): UnifiedOrder {
    return {
      id: order.id,
      symbol: order.instrument,
      market: 'FX',
      side: order.side.toUpperCase() as 'BUY' | 'SELL',
      quantity: order.units,
      price: order.price || 0,
      type: order.type as 'LIMIT' | 'MARKET' | 'STOP' | 'STOP_LIMIT',
      status: order.state as 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED',
      createTime: order.createTime,
      fillTime: order.fillTime,
      filledQuantity: order.units,
      filledPrice: order.price,
      broker: 'OANDA',
    };
  }

  /**
   * ウィブル注文を統一形式に変換
   */
  private convertWebullOrderToUnified(order: WebullOrder): UnifiedOrder {
    return {
      id: order.orderId,
      symbol: order.symbol,
      market: 'US',
      side: order.side,
      quantity: order.quantity,
      price: order.price,
      type: order.type,
      status: order.status,
      createTime: order.createTime,
      fillTime: order.fillTime,
      filledQuantity: order.filledQuantity,
      filledPrice: order.filledPrice,
      broker: 'WEBULL',
    };
  }

  /**
   * OANDAポジションを統一形式に変換
   */
  private convertOandaPositionToUnified(position: OandaPosition): UnifiedPosition {
    const netUnits = position.long.units - position.short.units;
    const averagePrice = netUnits > 0 ? position.long.averagePrice : position.short.averagePrice;
    const currentPrice = (position.long.averagePrice + position.short.averagePrice) / 2;

    return {
      symbol: position.instrument,
      market: 'FX',
      quantity: netUnits,
      averagePrice: averagePrice,
      currentPrice: currentPrice,
      marketValue: Math.abs(netUnits) * currentPrice,
      unrealizedPl: position.unrealizedPl,
      unrealizedPlPercent: (position.unrealizedPl / (Math.abs(netUnits) * averagePrice)) * 100,
      broker: 'OANDA',
    };
  }

  /**
   * ウィブルポジションを統一形式に変換
   */
  private convertWebullPositionToUnified(position: WebullPosition): UnifiedPosition {
    return {
      symbol: position.symbol,
      market: 'US',
      quantity: position.quantity,
      averagePrice: position.averagePrice,
      currentPrice: position.currentPrice,
      marketValue: position.marketValue,
      unrealizedPl: position.unrealizedPl,
      unrealizedPlPercent: position.unrealizedPlPercent,
      broker: 'WEBULL',
    };
  }

  /**
   * OANDA価格を統一形式に変換
   */
  private convertOandaPriceToUnified(price: OandaPrice): UnifiedQuote {
    return {
      symbol: price.instrument,
      market: 'FX',
      price: (price.bid + price.ask) / 2,
      change: 0, // OANDAは変更値を提供しない
      changePercent: 0,
      volume: 0, // OANDAは出来高を提供しない
      high: price.ask,
      low: price.bid,
      open: (price.bid + price.ask) / 2,
      close: (price.bid + price.ask) / 2,
      timestamp: price.time,
      broker: 'OANDA',
    };
  }

  /**
   * ウィブル価格を統一形式に変換
   */
  private convertWebullQuoteToUnified(quote: WebullQuote): UnifiedQuote {
    return {
      symbol: quote.symbol,
      market: 'US',
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      volume: quote.volume,
      high: quote.high,
      low: quote.low,
      open: quote.open,
      close: quote.close,
      timestamp: quote.timestamp,
      broker: 'WEBULL',
    };
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<TradingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.oandaService.updateConfig(newConfig.oanda || {});
    this.webullService.updateConfig(newConfig.webull || {});
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): TradingConfig {
    return { ...this.config };
  }

  /**
   * 接続状態を取得
   */
  isConnectedToTrading(): boolean {
    return this.isConnected;
  }

  /**
   * サービスを停止
   */
  stop(): void {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.isConnected = false;
  }
}
