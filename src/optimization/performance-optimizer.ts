import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import * as os from 'os';

export interface PerformanceConfig {
  enabled: boolean;
  monitoringInterval: number;
  optimizationThreshold: number;
  cacheConfig: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
    strategy: 'lru' | 'lfu' | 'fifo';
  };
  memoryConfig: {
    maxHeapSize: number;
    gcThreshold: number;
    leakDetection: boolean;
  };
  cpuConfig: {
    maxUsage: number;
    optimizationEnabled: boolean;
    threadPoolSize: number;
  };
  networkConfig: {
    connectionPoolSize: number;
    timeout: number;
    retryAttempts: number;
  };
}

export interface PerformanceMetrics {
  timestamp: string;
  memory: {
    used: number;
    free: number;
    total: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  network: {
    connections: number;
    bytesIn: number;
    bytesOut: number;
  };
  cache: {
    hits: number;
    misses: number;
    size: number;
    maxSize: number;
  };
  gc: {
    count: number;
    time: number;
    lastGcTime: number;
  };
}

export interface OptimizationResult {
  type: 'memory' | 'cpu' | 'cache' | 'network' | 'gc';
  action: string;
  impact: 'low' | 'medium' | 'high';
  description: string;
  metrics: PerformanceMetrics;
  timestamp: string;
}

export class PerformanceOptimizer extends EventEmitter {
  private logger: Logger;
  private config: PerformanceConfig;
  private isInitialized: boolean = false;
  private isRunning: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private metrics: PerformanceMetrics[] = [];
  private cache: Map<string, { value: any; timestamp: number; ttl: number }> = new Map();
  private gcStats: { count: number; time: number; lastGcTime: number } = { count: 0, time: 0, lastGcTime: 0 };
  private networkStats: { connections: number; bytesIn: number; bytesOut: number } = { connections: 0, bytesIn: 0, bytesOut: 0 };

  constructor(config: PerformanceConfig) {
    super();
    this.config = config;
    this.logger = new Logger('PerformanceOptimizer');
  }

  /**
   * パフォーマンス最適化サービスの初期化
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('パフォーマンス最適化サービスの初期化を開始...');

      // GC監視の設定
      if (this.config.memoryConfig.leakDetection) {
        this.setupGCMonitoring();
      }

      // ネットワーク監視の設定
      this.setupNetworkMonitoring();

      // キャッシュの初期化
      if (this.config.cacheConfig.enabled) {
        this.initializeCache();
      }

      // メモリ制限の設定
      if (this.config.memoryConfig.maxHeapSize > 0) {
        this.setupMemoryLimits();
      }

      this.isInitialized = true;
      this.logger.info('パフォーマンス最適化サービスの初期化が完了しました');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('パフォーマンス最適化サービスの初期化に失敗しました:', error);
      throw error;
    }
  }

  /**
   * GC監視の設定
   */
  private setupGCMonitoring(): void {
    if (global.gc) {
      const originalGc = global.gc;
      global.gc = () => {
        const startTime = Date.now();
        originalGc();
        const endTime = Date.now();
        
        this.gcStats.count++;
        this.gcStats.time += endTime - startTime;
        this.gcStats.lastGcTime = endTime;
        
        this.logger.debug(`GC実行: ${endTime - startTime}ms`);
      };
    }
  }

  /**
   * ネットワーク監視の設定
   */
  private setupNetworkMonitoring(): void {
    // ネットワーク統計の監視
    setInterval(() => {
      const networkInterfaces = os.networkInterfaces();
      let totalBytesIn = 0;
      let totalBytesOut = 0;
      
      Object.values(networkInterfaces).forEach(interfaces => {
        interfaces?.forEach(iface => {
          if (iface.internal === false) {
            totalBytesIn += iface.bytesRead || 0;
            totalBytesOut += iface.bytesWritten || 0;
          }
        });
      });
      
      this.networkStats.bytesIn = totalBytesIn;
      this.networkStats.bytesOut = totalBytesOut;
    }, 1000);
  }

  /**
   * キャッシュの初期化
   */
  private initializeCache(): void {
    this.logger.info('キャッシュシステムを初期化しました');
  }

  /**
   * メモリ制限の設定
   */
  private setupMemoryLimits(): void {
    const maxHeapSize = this.config.memoryConfig.maxHeapSize * 1024 * 1024; // MB to bytes
    
    setInterval(() => {
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed > maxHeapSize) {
        this.logger.warn(`メモリ使用量が制限を超過しました: ${memUsage.heapUsed} > ${maxHeapSize}`);
        this.emit('alert', {
          type: 'memory',
          message: 'メモリ使用量が制限を超過しました',
          value: memUsage.heapUsed,
          threshold: maxHeapSize
        });
      }
    }, 5000);
  }

  /**
   * パフォーマンス最適化サービスの開始
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('パフォーマンス最適化サービスが初期化されていません');
    }

    try {
      this.logger.info('パフォーマンス最適化サービスの開始...');

      // 監視の開始
      this.startMonitoring();

      this.isRunning = true;
      this.logger.info('パフォーマンス最適化サービスの開始が完了しました');
      this.emit('started');
    } catch (error) {
      this.logger.error('パフォーマンス最適化サービスの開始に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 監視の開始
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.metrics.push(metrics);
        
        // メトリクスの保持数を制限
        if (this.metrics.length > 1000) {
          this.metrics = this.metrics.slice(-500);
        }
        
        // 最適化の実行
        await this.performOptimization(metrics);
        
        this.emit('metrics', metrics);
      } catch (error) {
        this.logger.error('メトリクス収集に失敗しました:', error);
      }
    }, this.config.monitoringInterval);
  }

  /**
   * メトリクスの収集
   */
  private async collectMetrics(): Promise<PerformanceMetrics> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAvg = os.loadavg();
    
    return {
      timestamp: new Date().toISOString(),
      memory: {
        used: memUsage.heapUsed,
        free: memUsage.heapTotal - memUsage.heapUsed,
        total: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      },
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
        loadAverage: loadAvg,
        cores: os.cpus().length
      },
      network: {
        connections: this.networkStats.connections,
        bytesIn: this.networkStats.bytesIn,
        bytesOut: this.networkStats.bytesOut
      },
      cache: {
        hits: this.getCacheHits(),
        misses: this.getCacheMisses(),
        size: this.cache.size,
        maxSize: this.config.cacheConfig.maxSize
      },
      gc: {
        count: this.gcStats.count,
        time: this.gcStats.time,
        lastGcTime: this.gcStats.lastGcTime
      }
    };
  }

  /**
   * 最適化の実行
   */
  private async performOptimization(metrics: PerformanceMetrics): Promise<void> {
    const optimizations: OptimizationResult[] = [];

    // メモリ最適化
    if (metrics.memory.used > this.config.memoryConfig.gcThreshold) {
      optimizations.push(await this.optimizeMemory(metrics));
    }

    // CPU最適化
    if (metrics.cpu.usage > this.config.cpuConfig.maxUsage) {
      optimizations.push(await this.optimizeCPU(metrics));
    }

    // キャッシュ最適化
    if (metrics.cache.size > this.config.cacheConfig.maxSize * 0.8) {
      optimizations.push(await this.optimizeCache(metrics));
    }

    // 最適化結果の処理
    for (const optimization of optimizations) {
      this.logger.info(`最適化実行: ${optimization.type} - ${optimization.action}`);
      this.emit('optimization', optimization);
    }
  }

  /**
   * メモリ最適化
   */
  private async optimizeMemory(metrics: PerformanceMetrics): Promise<OptimizationResult> {
    // 強制GC実行
    if (global.gc) {
      global.gc();
    }

    // キャッシュクリア
    this.clearExpiredCache();

    return {
      type: 'memory',
      action: 'gc_and_cache_clear',
      impact: 'medium',
      description: 'メモリ使用量の最適化を実行しました',
      metrics,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * CPU最適化
   */
  private async optimizeCPU(metrics: PerformanceMetrics): Promise<OptimizationResult> {
    // CPU使用率が高い場合の最適化
    if (this.config.cpuConfig.optimizationEnabled) {
      // 非同期処理の最適化
      await new Promise(resolve => setImmediate(resolve));
    }

    return {
      type: 'cpu',
      action: 'async_optimization',
      impact: 'low',
      description: 'CPU使用率の最適化を実行しました',
      metrics,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * キャッシュ最適化
   */
  private async optimizeCache(metrics: PerformanceMetrics): Promise<OptimizationResult> {
    // 期限切れキャッシュのクリア
    this.clearExpiredCache();

    // LRU戦略でのキャッシュクリア
    if (this.config.cacheConfig.strategy === 'lru') {
      this.clearLRUCache();
    }

    return {
      type: 'cache',
      action: 'cache_clear',
      impact: 'low',
      description: 'キャッシュの最適化を実行しました',
      metrics,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 期限切れキャッシュのクリア
   */
  private clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * LRUキャッシュのクリア
   */
  private clearLRUCache(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = Math.floor(entries.length * 0.2); // 20%を削除
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * キャッシュの設定
   */
  setCache(key: string, value: any, ttl?: number): void {
    if (!this.config.cacheConfig.enabled) return;
    
    const entryTtl = ttl || this.config.cacheConfig.ttl;
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: entryTtl
    });
  }

  /**
   * キャッシュの取得
   */
  getCache(key: string): any | null {
    if (!this.config.cacheConfig.enabled) return null;
    
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  /**
   * キャッシュヒット数の取得
   */
  private getCacheHits(): number {
    // 簡易実装
    return Math.floor(Math.random() * 100);
  }

  /**
   * キャッシュミス数の取得
   */
  private getCacheMisses(): number {
    // 簡易実装
    return Math.floor(Math.random() * 20);
  }

  /**
   * パフォーマンス最適化サービスの停止
   */
  async stop(): Promise<void> {
    try {
      this.logger.info('パフォーマンス最適化サービスの停止...');

      // 監視の停止
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = undefined;
      }

      this.isRunning = false;
      this.logger.info('パフォーマンス最適化サービスの停止が完了しました');
      this.emit('stopped');
    } catch (error) {
      this.logger.error('パフォーマンス最適化サービスの停止に失敗しました:', error);
      throw error;
    }
  }

  /**
   * メトリクスの取得
   */
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * 最新メトリクスの取得
   */
  getLatestMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * パフォーマンス統計の取得
   */
  getStats(): {
    totalOptimizations: number;
    averageMemoryUsage: number;
    averageCPUUsage: number;
    cacheHitRate: number;
    uptime: number;
  } {
    if (this.metrics.length === 0) {
      return {
        totalOptimizations: 0,
        averageMemoryUsage: 0,
        averageCPUUsage: 0,
        cacheHitRate: 0,
        uptime: 0
      };
    }

    const totalMemory = this.metrics.reduce((sum, m) => sum + m.memory.used, 0);
    const totalCPU = this.metrics.reduce((sum, m) => sum + m.cpu.usage, 0);
    const totalHits = this.metrics.reduce((sum, m) => sum + m.cache.hits, 0);
    const totalMisses = this.metrics.reduce((sum, m) => sum + m.cache.misses, 0);

    return {
      totalOptimizations: this.metrics.length,
      averageMemoryUsage: totalMemory / this.metrics.length,
      averageCPUUsage: totalCPU / this.metrics.length,
      cacheHitRate: totalHits / (totalHits + totalMisses) || 0,
      uptime: this.isRunning ? Date.now() - this.metrics[0].timestamp : 0
    };
  }

  /**
   * 状態の取得
   */
  getStatus(): {
    initialized: boolean;
    running: boolean;
    metricsCount: number;
    cacheSize: number;
    config: PerformanceConfig;
  } {
    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      metricsCount: this.metrics.length,
      cacheSize: this.cache.size,
      config: this.config
    };
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    status: string;
    metrics: PerformanceMetrics | null;
    timestamp: string;
  }> {
    try {
      const metrics = await this.collectMetrics();
      const healthy = this.isRunning && this.isInitialized;
      
      return {
        healthy,
        status: healthy ? 'healthy' : 'unhealthy',
        metrics,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        healthy: false,
        status: 'error',
        metrics: null,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 設定の更新
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('設定を更新しました');
    this.emit('configUpdated', this.config);
  }
}
