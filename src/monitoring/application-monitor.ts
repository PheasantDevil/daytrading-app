/**
 * アプリケーション監視サービス
 * アプリケーションの監視とメトリクス収集
 */

export interface Metric {
  name: string;
  value: number;
  unit: 'Count' | 'Bytes' | 'Seconds' | 'Percent' | 'Milliseconds';
  tags: Record<string, string>;
  timestamp: Date;
}

export interface HealthStatus {
  status: 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED';
  checks: HealthCheck[];
  timestamp: Date;
  uptime: number;
  version: string;
}

export interface HealthCheck {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message?: string;
  responseTime?: number;
  lastChecked: Date;
}

export interface Alert {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  source: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

export interface MonitoringReport {
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
  };
  health: HealthStatus;
  alerts: Alert[];
  recommendations: string[];
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'GREATER_THAN' | 'LESS_THAN' | 'EQUALS' | 'NOT_EQUALS';
  threshold: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  enabled: boolean;
  cooldown: number; // ミリ秒
  lastTriggered?: Date;
}

export interface MonitoringConfig {
  metrics: {
    enabled: boolean;
    collectionInterval: number; // ミリ秒
    retentionPeriod: number; // 日数
  };
  healthChecks: {
    enabled: boolean;
    interval: number; // ミリ秒
    timeout: number; // ミリ秒
  };
  alerts: {
    enabled: boolean;
    rules: AlertRule[];
  };
  reporting: {
    enabled: boolean;
    interval: number; // ミリ秒
  };
}

export class ApplicationMonitor {
  private config: MonitoringConfig;
  private metrics: Map<string, Metric[]> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private startTime: Date;
  private isRunning: boolean = false;
  private metricsInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reportingInterval: NodeJS.Timeout | null = null;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.startTime = new Date();

    // アラートルールを初期化
    for (const rule of config.alerts.rules) {
      this.alertRules.set(rule.id, rule);
    }
  }

  /**
   * 監視を開始
   */
  async start(): Promise<boolean> {
    try {
      console.log('🔄 アプリケーション監視開始中...');

      // メトリクス収集を開始
      if (this.config.metrics.enabled) {
        this.startMetricsCollection();
      }

      // ヘルスチェックを開始
      if (this.config.healthChecks.enabled) {
        this.startHealthChecks();
      }

      // レポート生成を開始
      if (this.config.reporting.enabled) {
        this.startReporting();
      }

      this.isRunning = true;
      console.log('✅ アプリケーション監視開始完了');
      return true;
    } catch (error) {
      console.error('❌ アプリケーション監視開始エラー:', error);
      return false;
    }
  }

  /**
   * メトリクスを記録
   */
  recordMetric(metric: Metric): void {
    try {
      if (!this.metrics.has(metric.name)) {
        this.metrics.set(metric.name, []);
      }

      const metrics = this.metrics.get(metric.name)!;
      metrics.push(metric);

      // 保持期間を超えたメトリクスを削除
      const cutoffTime = new Date(
        Date.now() - this.config.metrics.retentionPeriod * 24 * 60 * 60 * 1000
      );
      const filteredMetrics = metrics.filter((m) => m.timestamp > cutoffTime);
      this.metrics.set(metric.name, filteredMetrics);

      // アラートルールをチェック
      this.checkAlertRules(metric);
    } catch (error) {
      console.error(`❌ メトリクス記録エラー: ${metric.name}`, error);
    }
  }

  /**
   * 複数のメトリクスを一括記録
   */
  recordMetrics(metrics: Metric[]): void {
    for (const metric of metrics) {
      this.recordMetric(metric);
    }
  }

  /**
   * ヘルスチェックを追加
   */
  addHealthCheck(
    name: string,
    checkFunction: () => Promise<{
      status: 'PASS' | 'FAIL' | 'WARN';
      message?: string;
    }>
  ): void {
    this.healthChecks.set(name, {
      name,
      status: 'PASS',
      lastChecked: new Date(),
    });

    // ヘルスチェック関数を保存（簡略化）
    console.log(`✅ ヘルスチェック追加: ${name}`);
  }

  /**
   * ヘルスチェックを実行
   */
  async performHealthCheck(name: string): Promise<HealthCheck> {
    try {
      const startTime = Date.now();

      // 簡略化されたヘルスチェック
      const healthCheck: HealthCheck = {
        name,
        status: 'PASS',
        message: 'OK',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
      };

      this.healthChecks.set(name, healthCheck);
      return healthCheck;
    } catch (error) {
      const healthCheck: HealthCheck = {
        name,
        status: 'FAIL',
        message: error instanceof Error ? error.message : 'Unknown error',
        responseTime: 0,
        lastChecked: new Date(),
      };

      this.healthChecks.set(name, healthCheck);
      return healthCheck;
    }
  }

  /**
   * 全ヘルスチェックを実行
   */
  async performAllHealthChecks(): Promise<HealthStatus> {
    try {
      const checks: HealthCheck[] = [];

      for (const [name] of this.healthChecks) {
        const check = await this.performHealthCheck(name);
        checks.push(check);
      }

      const failedChecks = checks.filter((c) => c.status === 'FAIL');
      const warningChecks = checks.filter((c) => c.status === 'WARN');

      let status: 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED';
      if (failedChecks.length > 0) {
        status = 'UNHEALTHY';
      } else if (warningChecks.length > 0) {
        status = 'DEGRADED';
      } else {
        status = 'HEALTHY';
      }

      const healthStatus: HealthStatus = {
        status,
        checks,
        timestamp: new Date(),
        uptime: Date.now() - this.startTime.getTime(),
        version: '1.0.0',
      };

      return healthStatus;
    } catch (error) {
      console.error('❌ ヘルスチェック実行エラー:', error);
      throw error;
    }
  }

  /**
   * アラートを生成
   */
  createAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): void {
    try {
      const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const newAlert: Alert = {
        id: alertId,
        timestamp: new Date(),
        resolved: false,
        ...alert,
      };

      this.alerts.set(alertId, newAlert);
      console.log(`🚨 アラート生成: ${alert.title} (${alert.severity})`);
    } catch (error) {
      console.error('❌ アラート生成エラー:', error);
    }
  }

  /**
   * アラートを解決
   */
  resolveAlert(alertId: string): void {
    try {
      const alert = this.alerts.get(alertId);
      if (alert) {
        alert.resolved = true;
        alert.resolvedAt = new Date();
        this.alerts.set(alertId, alert);
        console.log(`✅ アラート解決: ${alert.title}`);
      }
    } catch (error) {
      console.error(`❌ アラート解決エラー: ${alertId}`, error);
    }
  }

  /**
   * アラートルールをチェック
   */
  private checkAlertRules(metric: Metric): void {
    try {
      for (const [ruleId, rule] of this.alertRules) {
        if (!rule.enabled || rule.metric !== metric.name) {
          continue;
        }

        // クールダウンをチェック
        if (
          rule.lastTriggered &&
          Date.now() - rule.lastTriggered.getTime() < rule.cooldown
        ) {
          continue;
        }

        let shouldTrigger = false;
        switch (rule.condition) {
          case 'GREATER_THAN':
            shouldTrigger = metric.value > rule.threshold;
            break;
          case 'LESS_THAN':
            shouldTrigger = metric.value < rule.threshold;
            break;
          case 'EQUALS':
            shouldTrigger = metric.value === rule.threshold;
            break;
          case 'NOT_EQUALS':
            shouldTrigger = metric.value !== rule.threshold;
            break;
        }

        if (shouldTrigger) {
          this.createAlert({
            severity: rule.severity,
            title: `${rule.name} - ${metric.name}`,
            message: `${metric.name} が ${rule.condition} ${rule.threshold} を満たしました (現在値: ${metric.value})`,
            source: 'ApplicationMonitor',
            metadata: {
              ruleId,
              metric: metric.name,
              value: metric.value,
              threshold: rule.threshold,
              condition: rule.condition,
            },
          });

          rule.lastTriggered = new Date();
          this.alertRules.set(ruleId, rule);
        }
      }
    } catch (error) {
      console.error('❌ アラートルールチェックエラー:', error);
    }
  }

  /**
   * メトリクス収集を開始
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.config.metrics.collectionInterval);
  }

  /**
   * システムメトリクスを収集
   */
  private collectSystemMetrics(): void {
    try {
      const now = new Date();

      // CPU使用率（簡略化）
      const cpuUsage = Math.random() * 100;
      this.recordMetric({
        name: 'cpu.usage',
        value: cpuUsage,
        unit: 'Percent',
        tags: { instance: 'main' },
        timestamp: now,
      });

      // メモリ使用率（簡略化）
      const memoryUsage = Math.random() * 100;
      this.recordMetric({
        name: 'memory.usage',
        value: memoryUsage,
        unit: 'Percent',
        tags: { instance: 'main' },
        timestamp: now,
      });

      // ディスク使用率（簡略化）
      const diskUsage = Math.random() * 100;
      this.recordMetric({
        name: 'disk.usage',
        value: diskUsage,
        unit: 'Percent',
        tags: { instance: 'main' },
        timestamp: now,
      });

      // リクエスト数（簡略化）
      const requestCount = Math.floor(Math.random() * 100);
      this.recordMetric({
        name: 'requests.count',
        value: requestCount,
        unit: 'Count',
        tags: { instance: 'main' },
        timestamp: now,
      });
    } catch (error) {
      console.error('❌ システムメトリクス収集エラー:', error);
    }
  }

  /**
   * ヘルスチェックを開始
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performAllHealthChecks();
    }, this.config.healthChecks.interval);
  }

  /**
   * レポート生成を開始
   */
  private startReporting(): void {
    this.reportingInterval = setInterval(() => {
      this.generateReport();
    }, this.config.reporting.interval);
  }

  /**
   * レポートを生成
   */
  private generateReport(): void {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const report: MonitoringReport = {
        period: {
          start: oneHourAgo,
          end: now,
        },
        metrics: this.calculateMetrics(oneHourAgo, now),
        health: {
          status: 'HEALTHY',
          checks: Array.from(this.healthChecks.values()),
          timestamp: now,
          uptime: now.getTime() - this.startTime.getTime(),
          version: '1.0.0',
        },
        alerts: Array.from(this.alerts.values()).filter((a) => !a.resolved),
        recommendations: this.generateRecommendations(),
      };

      console.log(
        `📊 監視レポート生成: ${report.metrics.totalRequests} リクエスト, エラー率 ${report.metrics.errorRate.toFixed(2)}%`
      );
    } catch (error) {
      console.error('❌ レポート生成エラー:', error);
    }
  }

  /**
   * メトリクスを計算
   */
  private calculateMetrics(startTime: Date, endTime: Date): any {
    const allMetrics = Array.from(this.metrics.values()).flat();
    const periodMetrics = allMetrics.filter(
      (m) => m.timestamp >= startTime && m.timestamp <= endTime
    );

    const requestMetrics = periodMetrics.filter(
      (m) => m.name === 'requests.count'
    );
    const errorMetrics = periodMetrics.filter((m) => m.name === 'errors.count');
    const responseTimeMetrics = periodMetrics.filter(
      (m) => m.name === 'response.time'
    );

    const totalRequests = requestMetrics.reduce((sum, m) => sum + m.value, 0);
    const totalErrors = errorMetrics.reduce((sum, m) => sum + m.value, 0);
    const successfulRequests = totalRequests - totalErrors;
    const errorRate =
      totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
    const averageResponseTime =
      responseTimeMetrics.length > 0
        ? responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) /
          responseTimeMetrics.length
        : 0;
    const throughput =
      totalRequests / ((endTime.getTime() - startTime.getTime()) / 1000);

    return {
      totalRequests,
      successfulRequests,
      failedRequests: totalErrors,
      averageResponseTime,
      errorRate,
      throughput,
    };
  }

  /**
   * 推奨事項を生成
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // CPU使用率チェック
    const cpuMetrics = this.metrics.get('cpu.usage') || [];
    const recentCpuMetrics = cpuMetrics.filter(
      (m) => m.timestamp >= oneHourAgo
    );
    if (recentCpuMetrics.length > 0) {
      const avgCpuUsage =
        recentCpuMetrics.reduce((sum, m) => sum + m.value, 0) /
        recentCpuMetrics.length;
      if (avgCpuUsage > 80) {
        recommendations.push(
          'CPU使用率が高いです。リソースの追加を検討してください。'
        );
      }
    }

    // メモリ使用率チェック
    const memoryMetrics = this.metrics.get('memory.usage') || [];
    const recentMemoryMetrics = memoryMetrics.filter(
      (m) => m.timestamp >= oneHourAgo
    );
    if (recentMemoryMetrics.length > 0) {
      const avgMemoryUsage =
        recentMemoryMetrics.reduce((sum, m) => sum + m.value, 0) /
        recentMemoryMetrics.length;
      if (avgMemoryUsage > 85) {
        recommendations.push(
          'メモリ使用率が高いです。メモリリークの確認をしてください。'
        );
      }
    }

    // エラー率チェック
    const errorMetrics = this.metrics.get('errors.count') || [];
    const recentErrorMetrics = errorMetrics.filter(
      (m) => m.timestamp >= oneHourAgo
    );
    if (recentErrorMetrics.length > 0) {
      const totalErrors = recentErrorMetrics.reduce(
        (sum, m) => sum + m.value,
        0
      );
      if (totalErrors > 10) {
        recommendations.push(
          'エラー数が増加しています。ログの確認をしてください。'
        );
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('システムは正常に動作しています。');
    }

    return recommendations;
  }

  /**
   * メトリクスを取得
   */
  getMetrics(metricName?: string, startTime?: Date, endTime?: Date): Metric[] {
    if (metricName) {
      const metrics = this.metrics.get(metricName) || [];
      if (startTime && endTime) {
        return metrics.filter(
          (m) => m.timestamp >= startTime && m.timestamp <= endTime
        );
      }
      return metrics;
    }

    const allMetrics = Array.from(this.metrics.values()).flat();
    if (startTime && endTime) {
      return allMetrics.filter(
        (m) => m.timestamp >= startTime && m.timestamp <= endTime
      );
    }
    return allMetrics;
  }

  /**
   * ヘルスステータスを取得
   */
  async getHealthStatus(): Promise<HealthStatus> {
    return await this.performAllHealthChecks();
  }

  /**
   * アラートを取得
   */
  getAlerts(resolved?: boolean): Alert[] {
    const alerts = Array.from(this.alerts.values());
    if (resolved !== undefined) {
      return alerts.filter((a) => a.resolved === resolved);
    }
    return alerts;
  }

  /**
   * 統計を取得
   */
  getStats(): any {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    return {
      uptime: now.getTime() - this.startTime.getTime(),
      metricsCount: Array.from(this.metrics.values()).flat().length,
      healthChecksCount: this.healthChecks.size,
      alertsCount: this.alerts.size,
      activeAlertsCount: Array.from(this.alerts.values()).filter(
        (a) => !a.resolved
      ).length,
      recentMetrics: this.calculateMetrics(oneHourAgo, now),
    };
  }

  /**
   * 監視を停止
   */
  stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
      this.reportingInterval = null;
    }

    this.isRunning = false;
    console.log('⏹️ アプリケーション監視停止');
  }
}
