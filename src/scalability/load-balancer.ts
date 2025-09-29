/**
 * 負荷分散サービス
 * リクエストの負荷分散を管理
 */

export interface ServiceInstance {
  id: string;
  url: string;
  weight: number;
  health: 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN';
  lastHealthCheck: Date;
  responseTime: number;
  activeConnections: number;
  maxConnections: number;
  metadata: Record<string, any>;
}

export interface LoadBalancingStrategy {
  name: 'ROUND_ROBIN' | 'WEIGHTED_ROUND_ROBIN' | 'LEAST_CONNECTIONS' | 'LEAST_RESPONSE_TIME' | 'RANDOM';
  parameters?: Record<string, any>;
}

export interface HealthCheck {
  enabled: boolean;
  interval: number; // ミリ秒
  timeout: number; // ミリ秒
  path: string;
  expectedStatus: number;
  retries: number;
}

export interface LoadBalancerConfig {
  strategy: LoadBalancingStrategy;
  healthCheck: HealthCheck;
  maxRetries: number;
  retryDelay: number;
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    recoveryTimeout: number;
  };
  stickySession: {
    enabled: boolean;
    cookieName: string;
    maxAge: number;
  };
}

export interface Request {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  timestamp: Date;
  clientIp: string;
  sessionId?: string;
}

export interface Response {
  status: number;
  headers: Record<string, string>;
  body: any;
  responseTime: number;
  instanceId: string;
}

export interface LoadBalancerStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  activeInstances: number;
  unhealthyInstances: number;
  circuitBreakerTrips: number;
  lastUpdated: Date;
}

export class LoadBalancer {
  private config: LoadBalancerConfig;
  private instances: Map<string, ServiceInstance> = new Map();
  private currentIndex: number = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private stats: LoadBalancerStats;
  private stickySessions: Map<string, string> = new Map();

  constructor(config: LoadBalancerConfig) {
    this.config = config;
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      activeInstances: 0,
      unhealthyInstances: 0,
      circuitBreakerTrips: 0,
      lastUpdated: new Date(),
    };
  }

  /**
   * 負荷分散器を初期化
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🔄 負荷分散器初期化中...');

      // ヘルスチェックを開始
      if (this.config.healthCheck.enabled) {
        this.startHealthCheck();
      }

      // サーキットブレーカーを初期化
      if (this.config.circuitBreaker.enabled) {
        this.initializeCircuitBreakers();
      }

      console.log('✅ 負荷分散器初期化完了');
      return true;
    } catch (error) {
      console.error('❌ 負荷分散器初期化エラー:', error);
      return false;
    }
  }

  /**
   * インスタンスを追加
   */
  async addInstance(instance: ServiceInstance): Promise<void> {
    try {
      this.instances.set(instance.id, instance);
      
      // サーキットブレーカーを追加
      if (this.config.circuitBreaker.enabled) {
        this.circuitBreakers.set(instance.id, new CircuitBreaker(
          this.config.circuitBreaker.failureThreshold,
          this.config.circuitBreaker.recoveryTimeout
        ));
      }

      console.log(`✅ インスタンス追加: ${instance.id} (${instance.url})`);
      this.updateStats();
    } catch (error) {
      console.error(`❌ インスタンス追加エラー: ${instance.id}`, error);
      throw error;
    }
  }

  /**
   * インスタンスを削除
   */
  async removeInstance(instanceId: string): Promise<void> {
    try {
      this.instances.delete(instanceId);
      this.circuitBreakers.delete(instanceId);
      this.stickySessions.delete(instanceId);
      
      console.log(`✅ インスタンス削除: ${instanceId}`);
      this.updateStats();
    } catch (error) {
      console.error(`❌ インスタンス削除エラー: ${instanceId}`, error);
      throw error;
    }
  }

  /**
   * リクエストを分散
   */
  async distributeRequest(request: Request): Promise<Response> {
    try {
      this.stats.totalRequests++;

      // スティッキーセッションをチェック
      let selectedInstance: ServiceInstance | null = null;
      
      if (this.config.stickySession.enabled && request.sessionId) {
        const stickyInstanceId = this.stickySessions.get(request.sessionId);
        if (stickyInstanceId) {
          selectedInstance = this.instances.get(stickyInstanceId) || null;
        }
      }

      // インスタンスを選択
      if (!selectedInstance) {
        selectedInstance = this.selectInstance(request);
        if (!selectedInstance) {
          throw new Error('利用可能なインスタンスがありません');
        }

        // スティッキーセッションを設定
        if (this.config.stickySession.enabled && request.sessionId) {
          this.stickySessions.set(request.sessionId, selectedInstance.id);
        }
      }

      // サーキットブレーカーをチェック
      if (this.config.circuitBreaker.enabled) {
        const circuitBreaker = this.circuitBreakers.get(selectedInstance.id);
        if (circuitBreaker && !circuitBreaker.canExecute()) {
          throw new Error(`サーキットブレーカーが開いています: ${selectedInstance.id}`);
        }
      }

      // リクエストを実行
      const startTime = Date.now();
      const response = await this.executeRequest(selectedInstance, request);
      const responseTime = Date.now() - startTime;

      // レスポンス時間を更新
      selectedInstance.responseTime = responseTime;
      selectedInstance.activeConnections = Math.max(0, selectedInstance.activeConnections - 1);

      // サーキットブレーカーを更新
      if (this.config.circuitBreaker.enabled) {
        const circuitBreaker = this.circuitBreakers.get(selectedInstance.id);
        if (circuitBreaker) {
          circuitBreaker.recordSuccess();
        }
      }

      this.stats.successfulRequests++;
      this.updateStats();

      return {
        ...response,
        responseTime,
        instanceId: selectedInstance.id,
      };
    } catch (error) {
      this.stats.failedRequests++;
      this.updateStats();
      
      // サーキットブレーカーを更新
      if (this.config.circuitBreaker.enabled) {
        const circuitBreaker = this.circuitBreakers.get(selectedInstance?.id || '');
        if (circuitBreaker) {
          circuitBreaker.recordFailure();
          if (circuitBreaker.isOpen()) {
            this.stats.circuitBreakerTrips++;
          }
        }
      }

      console.error('❌ リクエスト分散エラー:', error);
      throw error;
    }
  }

  /**
   * インスタンスを選択
   */
  private selectInstance(request: Request): ServiceInstance | null {
    const healthyInstances = Array.from(this.instances.values())
      .filter(instance => instance.health === 'HEALTHY');

    if (healthyInstances.length === 0) {
      return null;
    }

    switch (this.config.strategy.name) {
      case 'ROUND_ROBIN':
        return this.roundRobinSelection(healthyInstances);
      case 'WEIGHTED_ROUND_ROBIN':
        return this.weightedRoundRobinSelection(healthyInstances);
      case 'LEAST_CONNECTIONS':
        return this.leastConnectionsSelection(healthyInstances);
      case 'LEAST_RESPONSE_TIME':
        return this.leastResponseTimeSelection(healthyInstances);
      case 'RANDOM':
        return this.randomSelection(healthyInstances);
      default:
        return this.roundRobinSelection(healthyInstances);
    }
  }

  /**
   * ラウンドロビン選択
   */
  private roundRobinSelection(instances: ServiceInstance[]): ServiceInstance {
    const instance = instances[this.currentIndex % instances.length];
    this.currentIndex++;
    return instance;
  }

  /**
   * 重み付きラウンドロビン選択
   */
  private weightedRoundRobinSelection(instances: ServiceInstance[]): ServiceInstance {
    const totalWeight = instances.reduce((sum, instance) => sum + instance.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const instance of instances) {
      random -= instance.weight;
      if (random <= 0) {
        return instance;
      }
    }
    
    return instances[0];
  }

  /**
   * 最少接続選択
   */
  private leastConnectionsSelection(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((min, instance) => 
      instance.activeConnections < min.activeConnections ? instance : min
    );
  }

  /**
   * 最少レスポンス時間選択
   */
  private leastResponseTimeSelection(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((min, instance) => 
      instance.responseTime < min.responseTime ? instance : min
    );
  }

  /**
   * ランダム選択
   */
  private randomSelection(instances: ServiceInstance[]): ServiceInstance {
    const index = Math.floor(Math.random() * instances.length);
    return instances[index];
  }

  /**
   * リクエストを実行
   */
  private async executeRequest(instance: ServiceInstance, request: Request): Promise<Response> {
    try {
      instance.activeConnections++;

      const response = await fetch(`${instance.url}${request.url}`, {
        method: request.method,
        headers: request.headers,
        body: request.body ? JSON.stringify(request.body) : undefined,
      });

      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: await response.json(),
        responseTime: 0, // 後で設定
        instanceId: instance.id,
      };
    } catch (error) {
      instance.activeConnections = Math.max(0, instance.activeConnections - 1);
      throw error;
    }
  }

  /**
   * ヘルスチェックを開始
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheck.interval);
  }

  /**
   * ヘルスチェックを実行
   */
  private async performHealthCheck(): Promise<void> {
    for (const [instanceId, instance] of this.instances) {
      try {
        const response = await fetch(`${instance.url}${this.config.healthCheck.path}`, {
          method: 'GET',
          timeout: this.config.healthCheck.timeout,
        });

        if (response.status === this.config.healthCheck.expectedStatus) {
          instance.health = 'HEALTHY';
        } else {
          instance.health = 'UNHEALTHY';
        }
      } catch (error) {
        instance.health = 'UNHEALTHY';
      }

      instance.lastHealthCheck = new Date();
    }

    this.updateStats();
  }

  /**
   * サーキットブレーカーを初期化
   */
  private initializeCircuitBreakers(): void {
    for (const [instanceId, instance] of this.instances) {
      this.circuitBreakers.set(instanceId, new CircuitBreaker(
        this.config.circuitBreaker.failureThreshold,
        this.config.circuitBreaker.recoveryTimeout
      ));
    }
  }

  /**
   * 統計を更新
   */
  private updateStats(): void {
    const instances = Array.from(this.instances.values());
    this.stats.activeInstances = instances.filter(i => i.health === 'HEALTHY').length;
    this.stats.unhealthyInstances = instances.filter(i => i.health === 'UNHEALTHY').length;
    this.stats.averageResponseTime = instances.reduce((sum, i) => sum + i.responseTime, 0) / instances.length;
    this.stats.lastUpdated = new Date();
  }

  /**
   * 統計を取得
   */
  getStats(): LoadBalancerStats {
    return { ...this.stats };
  }

  /**
   * インスタンス一覧を取得
   */
  getInstances(): ServiceInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * 設定を取得
   */
  getConfig(): LoadBalancerConfig {
    return { ...this.config };
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<LoadBalancerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('✅ 負荷分散器設定更新');
  }

  /**
   * 負荷分散器を停止
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    console.log('⏹️ 負荷分散器停止');
  }
}

/**
 * サーキットブレーカー
 */
class CircuitBreaker {
  private failureThreshold: number;
  private recoveryTimeout: number;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(failureThreshold: number, recoveryTimeout: number) {
    this.failureThreshold = failureThreshold;
    this.recoveryTimeout = recoveryTimeout;
  }

  canExecute(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }

    if (this.state === 'HALF_OPEN') {
      return true;
    }

    return false;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  isOpen(): boolean {
    return this.state === 'OPEN';
  }

  getState(): string {
    return this.state;
  }
}
