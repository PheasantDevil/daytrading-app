import { EventEmitter } from 'events';
import {
  IntegrationConfig,
  IntegrationService,
} from '../integration/integration-service';
import {
  PerformanceConfig,
  PerformanceOptimizer,
} from '../optimization/performance-optimizer';
import { Logger } from '../utils/logger';

export interface MainAppConfig {
  integration: IntegrationConfig;
  performance: PerformanceConfig;
  app: {
    name: string;
    version: string;
    environment: 'development' | 'staging' | 'production';
    port: number;
    host: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file: string;
    console: boolean;
  };
}

export class MainApp extends EventEmitter {
  private logger: Logger;
  private config: MainAppConfig;
  private integrationService: IntegrationService;
  private performanceOptimizer?: PerformanceOptimizer;
  private isInitialized: boolean = false;
  private isRunning: boolean = false;
  private startTime: Date = new Date();

  constructor(config: MainAppConfig) {
    super();
    this.config = config;
    this.logger = new Logger('MainApp');
    this.integrationService = new IntegrationService(config.integration);
  }

  /**
   * メインアプリケーションの初期化
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('メインアプリケーションの初期化を開始...');

      // ログ設定
      this.setupLogging();

      // 統合サービスの初期化
      await this.integrationService.initialize();

      // パフォーマンス最適化サービスの初期化
      if (this.config.performance.enabled) {
        this.performanceOptimizer = new PerformanceOptimizer(
          this.config.performance
        );
        await this.performanceOptimizer.initialize();
      }

      // イベントハンドラーの設定
      this.setupEventHandlers();

      // グレースフルシャットダウンの設定
      this.setupGracefulShutdown();

      this.isInitialized = true;
      this.logger.info('メインアプリケーションの初期化が完了しました');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('メインアプリケーションの初期化に失敗しました:', error);
      throw error;
    }
  }

  /**
   * ログ設定
   */
  private setupLogging(): void {
    this.logger.setLevel(this.config.logging.level);

    if (this.config.logging.file) {
      this.logger.setFileOutput(this.config.logging.file);
    }

    if (!this.config.logging.console) {
      this.logger.disableConsoleOutput();
    }
  }

  /**
   * イベントハンドラーの設定
   */
  private setupEventHandlers(): void {
    // 統合サービスのイベント
    this.integrationService.on('initialized', () => {
      this.logger.info('統合サービスが初期化されました');
    });

    this.integrationService.on('started', () => {
      this.logger.info('統合サービスが開始されました');
    });

    this.integrationService.on('stopped', () => {
      this.logger.info('統合サービスが停止されました');
    });

    this.integrationService.on('configUpdated', (config) => {
      this.logger.info('統合サービスの設定が更新されました');
    });

    // パフォーマンス最適化サービスのイベント
    if (this.performanceOptimizer) {
      this.performanceOptimizer.on('optimization', (result) => {
        this.logger.info('パフォーマンス最適化が実行されました:', result);
      });

      this.performanceOptimizer.on('alert', (alert) => {
        this.logger.warn('パフォーマンスアラート:', alert);
      });
    }

    // アプリケーションイベント
    this.on('error', (error) => {
      this.logger.error('アプリケーションエラー:', error);
    });
  }

  /**
   * グレースフルシャットダウンの設定
   */
  private setupGracefulShutdown(): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        this.logger.info(
          `${signal}シグナルを受信しました。グレースフルシャットダウンを開始...`
        );
        await this.shutdown();
      });
    });

    process.on('uncaughtException', async (error) => {
      this.logger.error('未捕捉例外:', error);
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      this.logger.error('未処理のPromise拒否:', reason);
      await this.shutdown();
      process.exit(1);
    });
  }

  /**
   * メインアプリケーションの開始
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('メインアプリケーションが初期化されていません');
    }

    try {
      this.logger.info('メインアプリケーションの開始...');

      // 統合サービスの開始
      await this.integrationService.start();

      // パフォーマンス最適化サービスの開始
      if (this.performanceOptimizer) {
        await this.performanceOptimizer.start();
      }

      this.isRunning = true;
      this.startTime = new Date();

      this.logger.info(
        `メインアプリケーションが開始されました (${this.config.app.name} v${this.config.app.version})`
      );
      this.logger.info(`環境: ${this.config.app.environment}`);
      this.logger.info(`ポート: ${this.config.app.port}`);
      this.logger.info(`ホスト: ${this.config.app.host}`);

      this.emit('started');
    } catch (error) {
      this.logger.error('メインアプリケーションの開始に失敗しました:', error);
      throw error;
    }
  }

  /**
   * メインアプリケーションの停止
   */
  async stop(): Promise<void> {
    try {
      this.logger.info('メインアプリケーションの停止...');

      // パフォーマンス最適化サービスの停止
      if (this.performanceOptimizer) {
        await this.performanceOptimizer.stop();
      }

      // 統合サービスの停止
      await this.integrationService.stop();

      this.isRunning = false;
      this.logger.info('メインアプリケーションの停止が完了しました');
      this.emit('stopped');
    } catch (error) {
      this.logger.error('メインアプリケーションの停止に失敗しました:', error);
      throw error;
    }
  }

  /**
   * グレースフルシャットダウン
   */
  async shutdown(): Promise<void> {
    try {
      this.logger.info('グレースフルシャットダウンを開始...');

      // 新規リクエストの受付停止
      this.logger.info('新規リクエストの受付を停止しました');

      // 実行中の処理の完了待ち
      this.logger.info('実行中の処理の完了を待機中...');
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // アプリケーションの停止
      await this.stop();

      this.logger.info('グレースフルシャットダウンが完了しました');
      this.emit('shutdown');
    } catch (error) {
      this.logger.error('グレースフルシャットダウンに失敗しました:', error);
      throw error;
    }
  }

  /**
   * アプリケーションの状態取得
   */
  getStatus(): {
    name: string;
    version: string;
    environment: string;
    initialized: boolean;
    running: boolean;
    uptime: number;
    startTime: string;
    integration: any;
    performance: any;
  } {
    const uptime = this.isRunning ? Date.now() - this.startTime.getTime() : 0;

    return {
      name: this.config.app.name,
      version: this.config.app.version,
      environment: this.config.app.environment,
      initialized: this.isInitialized,
      running: this.isRunning,
      uptime,
      startTime: this.startTime.toISOString(),
      integration: this.integrationService.getStatus(),
      performance: this.performanceOptimizer?.getStatus() || null,
    };
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    status: string;
    timestamp: string;
    services: any;
    performance: any;
  }> {
    try {
      const integrationHealth = await this.integrationService.healthCheck();
      const performanceHealth = this.performanceOptimizer
        ? await this.performanceOptimizer.healthCheck()
        : { healthy: true, status: 'disabled' };

      const healthy = integrationHealth.healthy && performanceHealth.healthy;
      const status = healthy ? 'healthy' : 'unhealthy';

      return {
        healthy,
        status,
        timestamp: new Date().toISOString(),
        services: integrationHealth,
        performance: performanceHealth,
      };
    } catch (error) {
      this.logger.error('ヘルスチェックに失敗しました:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        healthy: false,
        status: 'error',
        timestamp: new Date().toISOString(),
        services: { healthy: false, error: errorMessage },
        performance: { healthy: false, error: errorMessage },
      };
    }
  }

  /**
   * 設定の更新
   */
  updateConfig(newConfig: Partial<MainAppConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('設定を更新しました');
    this.emit('configUpdated', this.config);
  }

  /**
   * 統合サービスの取得
   */
  getIntegrationService(): IntegrationService {
    return this.integrationService;
  }

  /**
   * パフォーマンス最適化サービスの取得
   */
  getPerformanceOptimizer(): PerformanceOptimizer | undefined {
    return this.performanceOptimizer;
  }

  /**
   * アプリケーション情報の取得
   */
  getAppInfo(): {
    name: string;
    version: string;
    environment: string;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  } {
    const uptime = this.isRunning ? Date.now() - this.startTime.getTime() : 0;

    return {
      name: this.config.app.name,
      version: this.config.app.version,
      environment: this.config.app.environment,
      uptime,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };
  }

  /**
   * メトリクスの取得
   */
  getMetrics(): {
    app: any;
    integration: any;
    performance: any;
    system: {
      memory: NodeJS.MemoryUsage;
      cpu: NodeJS.CpuUsage;
      uptime: number;
    };
  } {
    return {
      app: this.getAppInfo(),
      integration: this.integrationService.getStatus(),
      performance: this.performanceOptimizer?.getMetrics() || null,
      system: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime(),
      },
    };
  }
}
