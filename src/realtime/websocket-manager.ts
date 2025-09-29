/**
 * WebSocket管理サービス
 * リアルタイムデータストリーミングとイベント管理
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';

export interface MarketEvent {
  id: string;
  type:
    | 'PRICE_UPDATE'
    | 'VOLUME_SPIKE'
    | 'PATTERN_DETECTED'
    | 'NEWS_ALERT'
    | 'ORDER_FILLED';
  symbol: string;
  data: any;
  timestamp: Date;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface StreamData {
  symbol: string;
  dataType: 'PRICE' | 'VOLUME' | 'ORDER_BOOK' | 'TRADES' | 'NEWS';
  data: any;
  timestamp: Date;
  source: string;
}

export interface WebSocketConnection {
  id: string;
  socket: WebSocket;
  subscriptions: Set<string>;
  lastPing: Date;
  isAlive: boolean;
  metadata: Record<string, any>;
}

export interface WebSocketConfig {
  port: number;
  heartbeatInterval: number; // ミリ秒
  maxConnections: number;
  maxSubscriptionsPerConnection: number;
  compressionEnabled: boolean;
  authentication: {
    enabled: boolean;
    secretKey: string;
    tokenExpiry: number; // ミリ秒
  };
  rateLimiting: {
    enabled: boolean;
    maxMessagesPerSecond: number;
    burstLimit: number;
  };
}

export interface StreamProcessor {
  processPriceData(data: StreamData): Promise<void>;
  processVolumeData(data: StreamData): Promise<void>;
  processOrderBookData(data: StreamData): Promise<void>;
  processTradeData(data: StreamData): Promise<void>;
  processNewsData(data: StreamData): Promise<void>;
}

export class WebSocketManager extends EventEmitter {
  private config: WebSocketConfig;
  private server: WebSocket.Server | null = null;
  private connections: Map<string, WebSocketConnection> = new Map();
  private streamProcessor: StreamProcessor;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private messageCounts: Map<string, { count: number; resetTime: Date }> =
    new Map();

  constructor(config: WebSocketConfig, streamProcessor: StreamProcessor) {
    super();
    this.config = config;
    this.streamProcessor = streamProcessor;
  }

  /**
   * WebSocketサーバーを開始
   */
  async start(): Promise<boolean> {
    try {
      console.log('🔄 WebSocketサーバー開始中...');

      this.server = new WebSocket.Server({
        port: this.config.port,
        perMessageDeflate: this.config.compressionEnabled,
      });

      this.server.on('connection', (socket, request) => {
        this.handleConnection(socket, request);
      });

      this.server.on('error', (error) => {
        console.error('❌ WebSocketサーバーエラー:', error);
        this.emit('error', error);
      });

      // ハートビートを開始
      this.startHeartbeat();

      this.isRunning = true;
      console.log(`✅ WebSocketサーバー開始完了: ポート${this.config.port}`);
      return true;
    } catch (error) {
      console.error('❌ WebSocketサーバー開始エラー:', error);
      return false;
    }
  }

  /**
   * WebSocketサーバーを停止
   */
  async stop(): Promise<void> {
    try {
      console.log('🔄 WebSocketサーバー停止中...');

      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // 全接続を閉じる
      for (const [connectionId, connection] of this.connections) {
        connection.socket.close();
        this.connections.delete(connectionId);
      }

      if (this.server) {
        this.server.close();
        this.server = null;
      }

      this.isRunning = false;
      console.log('✅ WebSocketサーバー停止完了');
    } catch (error) {
      console.error('❌ WebSocketサーバー停止エラー:', error);
    }
  }

  /**
   * 接続を処理
   */
  private handleConnection(socket: WebSocket, request: any): void {
    try {
      const connectionId = this.generateConnectionId();
      const connection: WebSocketConnection = {
        id: connectionId,
        socket,
        subscriptions: new Set(),
        lastPing: new Date(),
        isAlive: true,
        metadata: {
          ip: request.socket.remoteAddress,
          userAgent: request.headers['user-agent'],
          connectedAt: new Date(),
        },
      };

      this.connections.set(connectionId, connection);

      socket.on('message', (data) => {
        this.handleMessage(connectionId, data);
      });

      socket.on('close', () => {
        this.handleDisconnection(connectionId);
      });

      socket.on('error', (error) => {
        console.error(`❌ WebSocket接続エラー: ${connectionId}`, error);
        this.handleDisconnection(connectionId);
      });

      socket.on('pong', () => {
        const conn = this.connections.get(connectionId);
        if (conn) {
          conn.isAlive = true;
          conn.lastPing = new Date();
        }
      });

      // 接続確認メッセージを送信
      this.sendMessage(connectionId, {
        type: 'CONNECTION_ESTABLISHED',
        connectionId,
        timestamp: new Date(),
      });

      console.log(`✅ WebSocket接続確立: ${connectionId}`);
      this.emit('connection', connection);
    } catch (error) {
      console.error('❌ 接続処理エラー:', error);
    }
  }

  /**
   * メッセージを処理
   */
  private handleMessage(connectionId: string, data: WebSocket.Data): void {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return;

      // レート制限をチェック
      if (
        this.config.rateLimiting.enabled &&
        !this.checkRateLimit(connectionId)
      ) {
        this.sendError(
          connectionId,
          'RATE_LIMIT_EXCEEDED',
          'レート制限を超えました'
        );
        return;
      }

      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'SUBSCRIBE':
          this.handleSubscription(connectionId, message.symbols);
          break;
        case 'UNSUBSCRIBE':
          this.handleUnsubscription(connectionId, message.symbols);
          break;
        case 'PING':
          this.handlePing(connectionId);
          break;
        case 'AUTHENTICATE':
          this.handleAuthentication(connectionId, message.token);
          break;
        default:
          this.sendError(
            connectionId,
            'UNKNOWN_MESSAGE_TYPE',
            '不明なメッセージタイプです'
          );
      }
    } catch (error) {
      console.error(`❌ メッセージ処理エラー: ${connectionId}`, error);
      this.sendError(
        connectionId,
        'MESSAGE_PARSE_ERROR',
        'メッセージの解析に失敗しました'
      );
    }
  }

  /**
   * 購読を処理
   */
  private handleSubscription(connectionId: string, symbols: string[]): void {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return;

      // 購読数制限をチェック
      if (
        connection.subscriptions.size + symbols.length >
        this.config.maxSubscriptionsPerConnection
      ) {
        this.sendError(
          connectionId,
          'SUBSCRIPTION_LIMIT_EXCEEDED',
          '購読数制限を超えました'
        );
        return;
      }

      for (const symbol of symbols) {
        connection.subscriptions.add(symbol);
      }

      this.sendMessage(connectionId, {
        type: 'SUBSCRIPTION_CONFIRMED',
        symbols,
        timestamp: new Date(),
      });

      console.log(
        `✅ 購読追加: ${connectionId}, シンボル=${symbols.join(', ')}`
      );
    } catch (error) {
      console.error(`❌ 購読処理エラー: ${connectionId}`, error);
    }
  }

  /**
   * 購読解除を処理
   */
  private handleUnsubscription(connectionId: string, symbols: string[]): void {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return;

      for (const symbol of symbols) {
        connection.subscriptions.delete(symbol);
      }

      this.sendMessage(connectionId, {
        type: 'UNSUBSCRIPTION_CONFIRMED',
        symbols,
        timestamp: new Date(),
      });

      console.log(
        `✅ 購読解除: ${connectionId}, シンボル=${symbols.join(', ')}`
      );
    } catch (error) {
      console.error(`❌ 購読解除処理エラー: ${connectionId}`, error);
    }
  }

  /**
   * Pingを処理
   */
  private handlePing(connectionId: string): void {
    this.sendMessage(connectionId, {
      type: 'PONG',
      timestamp: new Date(),
    });
  }

  /**
   * 認証を処理
   */
  private handleAuthentication(connectionId: string, token: string): void {
    try {
      if (!this.config.authentication.enabled) {
        this.sendMessage(connectionId, {
          type: 'AUTHENTICATION_SUCCESS',
          timestamp: new Date(),
        });
        return;
      }

      // 簡略化された認証
      if (token === 'valid-token') {
        const connection = this.connections.get(connectionId);
        if (connection) {
          connection.metadata.authenticated = true;
          connection.metadata.authenticatedAt = new Date();
        }

        this.sendMessage(connectionId, {
          type: 'AUTHENTICATION_SUCCESS',
          timestamp: new Date(),
        });
      } else {
        this.sendError(
          connectionId,
          'AUTHENTICATION_FAILED',
          '認証に失敗しました'
        );
      }
    } catch (error) {
      console.error(`❌ 認証処理エラー: ${connectionId}`, error);
      this.sendError(
        connectionId,
        'AUTHENTICATION_ERROR',
        '認証処理中にエラーが発生しました'
      );
    }
  }

  /**
   * 接続切断を処理
   */
  private handleDisconnection(connectionId: string): void {
    try {
      const connection = this.connections.get(connectionId);
      if (connection) {
        console.log(`✅ WebSocket接続切断: ${connectionId}`);
        this.connections.delete(connectionId);
        this.messageCounts.delete(connectionId);
        this.emit('disconnection', connection);
      }
    } catch (error) {
      console.error(`❌ 接続切断処理エラー: ${connectionId}`, error);
    }
  }

  /**
   * 市場データストリームに接続
   */
  async connectToMarketData(symbol: string): Promise<void> {
    try {
      console.log(`🔄 市場データストリーム接続: ${symbol}`);

      // 簡略化された市場データ接続
      const streamData: StreamData = {
        symbol,
        dataType: 'PRICE',
        data: {
          price: Math.random() * 100 + 50,
          volume: Math.random() * 1000000,
        },
        timestamp: new Date(),
        source: 'market-data-provider',
      };

      await this.streamProcessor.processPriceData(streamData);
      console.log(`✅ 市場データストリーム接続完了: ${symbol}`);
    } catch (error) {
      console.error(`❌ 市場データストリーム接続エラー: ${symbol}`, error);
      throw error;
    }
  }

  /**
   * イベントをブロードキャスト
   */
  async broadcastEvent(event: MarketEvent): Promise<void> {
    try {
      const message = {
        type: 'MARKET_EVENT',
        event,
        timestamp: new Date(),
      };

      let broadcastCount = 0;
      for (const [connectionId, connection] of this.connections) {
        if (connection.subscriptions.has(event.symbol)) {
          this.sendMessage(connectionId, message);
          broadcastCount++;
        }
      }

      console.log(
        `✅ イベントブロードキャスト: ${event.type}, 接続数=${broadcastCount}`
      );
    } catch (error) {
      console.error('❌ イベントブロードキャストエラー:', error);
      throw error;
    }
  }

  /**
   * ストリームデータを処理
   */
  async processStream(data: StreamData): Promise<void> {
    try {
      switch (data.dataType) {
        case 'PRICE':
          await this.streamProcessor.processPriceData(data);
          break;
        case 'VOLUME':
          await this.streamProcessor.processVolumeData(data);
          break;
        case 'ORDER_BOOK':
          await this.streamProcessor.processOrderBookData(data);
          break;
        case 'TRADES':
          await this.streamProcessor.processTradeData(data);
          break;
        case 'NEWS':
          await this.streamProcessor.processNewsData(data);
          break;
      }

      // 購読者にデータを配信
      await this.broadcastStreamData(data);
    } catch (error) {
      console.error('❌ ストリームデータ処理エラー:', error);
      throw error;
    }
  }

  /**
   * ストリームデータをブロードキャスト
   */
  private async broadcastStreamData(data: StreamData): Promise<void> {
    try {
      const message = {
        type: 'STREAM_DATA',
        data,
        timestamp: new Date(),
      };

      let broadcastCount = 0;
      for (const [connectionId, connection] of this.connections) {
        if (connection.subscriptions.has(data.symbol)) {
          this.sendMessage(connectionId, message);
          broadcastCount++;
        }
      }

      console.log(
        `✅ ストリームデータブロードキャスト: ${data.symbol}, 接続数=${broadcastCount}`
      );
    } catch (error) {
      console.error('❌ ストリームデータブロードキャストエラー:', error);
    }
  }

  /**
   * メッセージを送信
   */
  private sendMessage(connectionId: string, message: any): void {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection || connection.socket.readyState !== WebSocket.OPEN)
        return;

      connection.socket.send(JSON.stringify(message));
    } catch (error) {
      console.error(`❌ メッセージ送信エラー: ${connectionId}`, error);
    }
  }

  /**
   * エラーメッセージを送信
   */
  private sendError(
    connectionId: string,
    errorCode: string,
    message: string
  ): void {
    this.sendMessage(connectionId, {
      type: 'ERROR',
      errorCode,
      message,
      timestamp: new Date(),
    });
  }

  /**
   * ハートビートを開始
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [connectionId, connection] of this.connections) {
        if (!connection.isAlive) {
          connection.socket.terminate();
          this.handleDisconnection(connectionId);
          continue;
        }

        connection.isAlive = false;
        connection.socket.ping();
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * レート制限をチェック
   */
  private checkRateLimit(connectionId: string): boolean {
    const now = new Date();
    const rateLimit = this.messageCounts.get(connectionId);

    if (!rateLimit) {
      this.messageCounts.set(connectionId, {
        count: 1,
        resetTime: new Date(now.getTime() + 1000),
      });
      return true;
    }

    if (now > rateLimit.resetTime) {
      rateLimit.count = 1;
      rateLimit.resetTime = new Date(now.getTime() + 1000);
      return true;
    }

    if (rateLimit.count >= this.config.rateLimiting.maxMessagesPerSecond) {
      return false;
    }

    rateLimit.count++;
    return true;
  }

  /**
   * 接続IDを生成
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 接続統計を取得
   */
  getConnectionStats(): any {
    const connections = Array.from(this.connections.values());
    const authenticatedConnections = connections.filter(
      (c) => c.metadata.authenticated
    );
    const totalSubscriptions = connections.reduce(
      (sum, c) => sum + c.subscriptions.size,
      0
    );

    return {
      totalConnections: connections.length,
      authenticatedConnections: authenticatedConnections.length,
      totalSubscriptions,
      averageSubscriptionsPerConnection:
        connections.length > 0 ? totalSubscriptions / connections.length : 0,
      isRunning: this.isRunning,
    };
  }

  /**
   * 設定を取得
   */
  getConfig(): WebSocketConfig {
    return { ...this.config };
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<WebSocketConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('✅ WebSocket設定更新');
  }
}
