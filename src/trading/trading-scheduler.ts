import { EventEmitter } from 'events';
import * as cron from 'node-cron';
import { Logger } from '../utils/logger';
import { AutoTradingService } from './auto-trading-service';

export interface TradingSchedule {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  enabled: boolean;
  config: any;
  lastRun?: Date;
  nextRun?: Date;
  status: 'active' | 'paused' | 'disabled';
}

export interface TradingSchedulerConfig {
  enabled: boolean;
  schedules: TradingSchedule[];
  timezone: string;
  maxConcurrentSessions: number;
  sessionTimeout: number; // milliseconds
  retryAttempts: number;
  retryDelay: number; // milliseconds
}

export class TradingScheduler extends EventEmitter {
  private logger: Logger;
  private config: TradingSchedulerConfig;
  private autoTradingService: AutoTradingService;
  private activeSessions: Map<string, any> = new Map();
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private isInitialized: boolean = false;
  private isRunning: boolean = false;

  constructor(
    config: TradingSchedulerConfig,
    autoTradingService: AutoTradingService
  ) {
    super();
    this.config = config;
    this.autoTradingService = autoTradingService;
    this.logger = new Logger('TradingScheduler');
  }

  /**
   * 取引スケジューラーの初期化
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('取引スケジューラーの初期化を開始...');

      // Initialize auto trading service
      await this.autoTradingService.initialize();

      // Setup event handlers
      this.setupEventHandlers();

      // Validate cron expressions
      this.validateCronExpressions();

      this.isInitialized = true;
      this.logger.info('取引スケジューラーの初期化が完了しました');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('取引スケジューラーの初期化に失敗しました:', error);
      throw error;
    }
  }

  /**
   * イベントハンドラーの設定
   */
  private setupEventHandlers(): void {
    // Auto trading service events
    this.autoTradingService.on('tradingStarted', (session) => {
      this.logger.info(`取引セッションが開始されました: ${session.sessionId}`);
      this.emit('sessionStarted', session);
    });

    this.autoTradingService.on('tradingStopped', (session) => {
      this.logger.info(`取引セッションが停止されました: ${session.sessionId}`);
      this.activeSessions.delete(session.sessionId);
      this.emit('sessionStopped', session);
    });

    this.autoTradingService.on('riskAlert', (alert) => {
      this.logger.warn('リスクアラートを受信:', alert);
      this.emit('riskAlert', alert);
    });

    this.autoTradingService.on('tradeExecuted', (trade) => {
      this.logger.info('取引が執行されました:', trade);
      this.emit('tradeExecuted', trade);
    });
  }

  /**
   * Cron式の検証
   */
  private validateCronExpressions(): void {
    for (const schedule of this.config.schedules) {
      if (!cron.validate(schedule.cronExpression)) {
        throw new Error(
          `無効なCron式: ${schedule.cronExpression} (スケジュール: ${schedule.name})`
        );
      }
    }
  }

  /**
   * スケジューラーの開始
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('取引スケジューラーが初期化されていません');
    }

    if (this.isRunning) {
      this.logger.warn('スケジューラーは既に実行中です');
      return;
    }

    try {
      this.logger.info('取引スケジューラーを開始...');

      // Schedule all enabled tasks
      for (const schedule of this.config.schedules) {
        if (schedule.enabled && schedule.status === 'active') {
          await this.scheduleTask(schedule);
        }
      }

      this.isRunning = true;
      this.logger.info('取引スケジューラーが開始されました');
      this.emit('started');
    } catch (error) {
      this.logger.error('取引スケジューラーの開始に失敗しました:', error);
      throw error;
    }
  }

  /**
   * タスクのスケジュール
   */
  private async scheduleTask(schedule: TradingSchedule): Promise<void> {
    try {
      const task = cron.schedule(
        schedule.cronExpression,
        async () => {
          await this.executeScheduledTask(schedule);
        },
        {
          scheduled: false,
          timezone: this.config.timezone,
        }
      );

      this.scheduledTasks.set(schedule.id, task);
      task.start();

      // Calculate next run time
      schedule.nextRun = this.calculateNextRun(schedule.cronExpression);

      this.logger.info(
        `スケジュールタスクを登録しました: ${schedule.name} (${schedule.cronExpression})`
      );
      this.emit('taskScheduled', schedule);
    } catch (error) {
      this.logger.error(
        `スケジュールタスクの登録に失敗しました: ${schedule.name}`,
        error
      );
      throw error;
    }
  }

  /**
   * スケジュールされたタスクの実行
   */
  private async executeScheduledTask(schedule: TradingSchedule): Promise<void> {
    try {
      this.logger.info(`スケジュールされたタスクを実行: ${schedule.name}`);

      // Check concurrent session limit
      if (this.activeSessions.size >= this.config.maxConcurrentSessions) {
        this.logger.warn('同時実行セッション数の上限に達しました');
        return;
      }

      // Update schedule info
      schedule.lastRun = new Date();
      schedule.nextRun = this.calculateNextRun(schedule.cronExpression);

      // Execute trading session
      await this.executeTradingSession(schedule);

      this.logger.info(
        `スケジュールされたタスクが完了しました: ${schedule.name}`
      );
      this.emit('taskCompleted', schedule);
    } catch (error) {
      this.logger.error(
        `スケジュールされたタスクの実行に失敗しました: ${schedule.name}`,
        error
      );
      this.emit('taskFailed', { schedule, error });
    }
  }

  /**
   * 取引セッションの実行
   */
  private async executeTradingSession(
    schedule: TradingSchedule
  ): Promise<void> {
    try {
      // Update auto trading service config
      this.autoTradingService.updateConfig(schedule.config);

      // Start trading
      await this.autoTradingService.startTrading();

      // Add to active sessions
      const session = this.autoTradingService.getCurrentSession();
      if (session) {
        this.activeSessions.set(session.sessionId, {
          schedule,
          startTime: new Date(),
          session,
        });

        // Set timeout for session
        setTimeout(() => {
          this.logger.warn(`セッションタイムアウト: ${session.sessionId}`);
          this.stopSession(session.sessionId);
        }, this.config.sessionTimeout);
      }
    } catch (error) {
      this.logger.error(
        `取引セッションの実行に失敗しました: ${schedule.name}`,
        error
      );
      throw error;
    }
  }

  /**
   * セッションの停止
   */
  private async stopSession(sessionId: string): Promise<void> {
    try {
      const sessionInfo = this.activeSessions.get(sessionId);
      if (!sessionInfo) {
        this.logger.warn(`セッションが見つかりません: ${sessionId}`);
        return;
      }

      await this.autoTradingService.stopTrading();
      this.activeSessions.delete(sessionId);

      this.logger.info(`セッションを停止しました: ${sessionId}`);
      this.emit('sessionStopped', sessionInfo);
    } catch (error) {
      this.logger.error(`セッションの停止に失敗しました: ${sessionId}`, error);
    }
  }

  /**
   * 次の実行時間の計算
   */
  private calculateNextRun(cronExpression: string): Date {
    // This is a simplified calculation
    // In reality, you would use a proper cron parser
    const now = new Date();
    const nextRun = new Date(now.getTime() + 60000); // Add 1 minute as example
    return nextRun;
  }

  /**
   * スケジュールの追加
   */
  async addSchedule(schedule: TradingSchedule): Promise<void> {
    try {
      // Validate cron expression
      if (!cron.validate(schedule.cronExpression)) {
        throw new Error(`無効なCron式: ${schedule.cronExpression}`);
      }

      // Add to config
      this.config.schedules.push(schedule);

      // Schedule task if scheduler is running
      if (this.isRunning && schedule.enabled && schedule.status === 'active') {
        await this.scheduleTask(schedule);
      }

      this.logger.info(`スケジュールを追加しました: ${schedule.name}`);
      this.emit('scheduleAdded', schedule);
    } catch (error) {
      this.logger.error(
        `スケジュールの追加に失敗しました: ${schedule.name}`,
        error
      );
      throw error;
    }
  }

  /**
   * スケジュールの更新
   */
  async updateSchedule(
    scheduleId: string,
    updates: Partial<TradingSchedule>
  ): Promise<void> {
    try {
      const scheduleIndex = this.config.schedules.findIndex(
        (s) => s.id === scheduleId
      );
      if (scheduleIndex === -1) {
        throw new Error(`スケジュールが見つかりません: ${scheduleId}`);
      }

      // Stop existing task
      const existingTask = this.scheduledTasks.get(scheduleId);
      if (existingTask) {
        existingTask.stop();
        this.scheduledTasks.delete(scheduleId);
      }

      // Update schedule
      this.config.schedules[scheduleIndex] = {
        ...this.config.schedules[scheduleIndex],
        ...updates,
      };

      // Schedule new task if scheduler is running
      if (
        this.isRunning &&
        updates.enabled !== false &&
        updates.status !== 'disabled'
      ) {
        await this.scheduleTask(this.config.schedules[scheduleIndex]);
      }

      this.logger.info(`スケジュールを更新しました: ${scheduleId}`);
      this.emit('scheduleUpdated', this.config.schedules[scheduleIndex]);
    } catch (error) {
      this.logger.error(
        `スケジュールの更新に失敗しました: ${scheduleId}`,
        error
      );
      throw error;
    }
  }

  /**
   * スケジュールの削除
   */
  async removeSchedule(scheduleId: string): Promise<void> {
    try {
      // Stop task
      const task = this.scheduledTasks.get(scheduleId);
      if (task) {
        task.stop();
        this.scheduledTasks.delete(scheduleId);
      }

      // Remove from config
      this.config.schedules = this.config.schedules.filter(
        (s) => s.id !== scheduleId
      );

      this.logger.info(`スケジュールを削除しました: ${scheduleId}`);
      this.emit('scheduleRemoved', scheduleId);
    } catch (error) {
      this.logger.error(
        `スケジュールの削除に失敗しました: ${scheduleId}`,
        error
      );
      throw error;
    }
  }

  /**
   * スケジュールの一時停止
   */
  async pauseSchedule(scheduleId: string): Promise<void> {
    try {
      const task = this.scheduledTasks.get(scheduleId);
      if (task) {
        task.stop();
      }

      const schedule = this.config.schedules.find((s) => s.id === scheduleId);
      if (schedule) {
        schedule.status = 'paused';
      }

      this.logger.info(`スケジュールを一時停止しました: ${scheduleId}`);
      this.emit('schedulePaused', scheduleId);
    } catch (error) {
      this.logger.error(
        `スケジュールの一時停止に失敗しました: ${scheduleId}`,
        error
      );
      throw error;
    }
  }

  /**
   * スケジュールの再開
   */
  async resumeSchedule(scheduleId: string): Promise<void> {
    try {
      const schedule = this.config.schedules.find((s) => s.id === scheduleId);
      if (!schedule) {
        throw new Error(`スケジュールが見つかりません: ${scheduleId}`);
      }

      schedule.status = 'active';

      if (this.isRunning && schedule.enabled) {
        await this.scheduleTask(schedule);
      }

      this.logger.info(`スケジュールを再開しました: ${scheduleId}`);
      this.emit('scheduleResumed', scheduleId);
    } catch (error) {
      this.logger.error(
        `スケジュールの再開に失敗しました: ${scheduleId}`,
        error
      );
      throw error;
    }
  }

  /**
   * スケジューラーの停止
   */
  async stop(): Promise<void> {
    try {
      this.logger.info('取引スケジューラーを停止...');

      // Stop all scheduled tasks
      for (const [scheduleId, task] of this.scheduledTasks) {
        task.stop();
      }
      this.scheduledTasks.clear();

      // Stop all active sessions
      for (const [sessionId, sessionInfo] of this.activeSessions) {
        await this.stopSession(sessionId);
      }

      this.isRunning = false;
      this.logger.info('取引スケジューラーが停止されました');
      this.emit('stopped');
    } catch (error) {
      this.logger.error('取引スケジューラーの停止に失敗しました:', error);
      throw error;
    }
  }

  /**
   * スケジュール一覧の取得
   */
  getSchedules(): TradingSchedule[] {
    return [...this.config.schedules];
  }

  /**
   * アクティブセッション一覧の取得
   */
  getActiveSessions(): any[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * スケジューラー統計の取得
   */
  getStats(): {
    totalSchedules: number;
    activeSchedules: number;
    activeSessions: number;
    totalExecutions: number;
    successRate: number;
  } {
    const activeSchedules = this.config.schedules.filter(
      (s) => s.enabled && s.status === 'active'
    ).length;

    return {
      totalSchedules: this.config.schedules.length,
      activeSchedules,
      activeSessions: this.activeSessions.size,
      totalExecutions: this.config.schedules.reduce(
        (sum, s) => sum + (s.lastRun ? 1 : 0),
        0
      ),
      successRate: 0.95, // Mock data
    };
  }

  /**
   * 設定の更新
   */
  updateConfig(newConfig: Partial<TradingSchedulerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('設定を更新しました');
    this.emit('configUpdated', this.config);
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    status: string;
    schedules: number;
    activeSessions: number;
    timestamp: string;
  }> {
    try {
      const healthy = this.isInitialized && this.isRunning;
      const status = this.isRunning ? 'running' : 'stopped';

      return {
        healthy,
        status,
        schedules: this.config.schedules.length,
        activeSessions: this.activeSessions.size,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        healthy: false,
        status: 'error',
        schedules: 0,
        activeSessions: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
