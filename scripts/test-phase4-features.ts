/**
 * Phase4機能テストスクリプト
 * クラウド統合、スケーラビリティ、監視・ログ、セキュリティ強化をテスト
 */

import { AWSIntegration } from '../src/cloud/aws-integration';
import { LoadBalancer } from '../src/scalability/load-balancer';
import { ApplicationMonitor } from '../src/monitoring/application-monitor';
import { AuthManager } from '../src/security/auth-manager';

async function testAWSIntegration(): Promise<void> {
  console.log('\n🧪 AWS統合テスト開始...');
  
  try {
    const awsIntegration = new AWSIntegration({
      region: 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test-key',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test-secret',
      s3: {
        bucket: 'test-bucket',
        region: 'us-east-1',
      },
      rds: {
        endpoint: 'test-endpoint',
        port: 5432,
        database: 'test-db',
        username: 'test-user',
        password: 'test-password',
      },
      lambda: {
        region: 'us-east-1',
        functions: {
          'test-function': 'test-function-name',
        },
      },
      cloudWatch: {
        namespace: 'TestApp',
        region: 'us-east-1',
      },
    });

    // 初期化テスト
    const initialized = await awsIntegration.initialize();
    console.log(`✅ AWS統合初期化: ${initialized ? '成功' : '失敗'}`);

    if (initialized) {
      // S3アップロードテスト
      try {
        const uploadResult = await awsIntegration.uploadToS3({
          key: 'test-file.json',
          bucket: 'test-bucket',
          body: JSON.stringify({ test: 'data' }),
          contentType: 'application/json',
          metadata: { source: 'test' },
        });
        console.log(`✅ S3アップロード: ${uploadResult}`);
      } catch (error) {
        console.log('⚠️ S3アップロード失敗（予想通り）');
      }

      // CloudWatchメトリクス送信テスト
      try {
        await awsIntegration.publishMetric({
          namespace: 'TestApp',
          metricName: 'test.metric',
          value: 100,
          unit: 'Count',
          dimensions: { instance: 'test' },
          timestamp: new Date(),
        });
        console.log('✅ CloudWatchメトリクス送信成功');
      } catch (error) {
        console.log('⚠️ CloudWatchメトリクス送信失敗（予想通り）');
      }

      // 状態取得テスト
      const status = awsIntegration.getStatus();
      console.log(`✅ AWS統合状態: 初期化=${status.initialized}, サービス=${JSON.stringify(status.services)}`);
    }

    console.log('✅ AWS統合テスト完了');
  } catch (error) {
    console.error('❌ AWS統合テストエラー:', error);
  }
}

async function testLoadBalancer(): Promise<void> {
  console.log('\n🧪 負荷分散器テスト開始...');
  
  try {
    const loadBalancer = new LoadBalancer({
      strategy: {
        name: 'ROUND_ROBIN',
        parameters: {},
      },
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        path: '/health',
        expectedStatus: 200,
        retries: 3,
      },
      maxRetries: 3,
      retryDelay: 1000,
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        recoveryTimeout: 60000,
      },
      stickySession: {
        enabled: true,
        cookieName: 'session-id',
        maxAge: 3600000,
      },
    });

    // 初期化テスト
    const initialized = await loadBalancer.initialize();
    console.log(`✅ 負荷分散器初期化: ${initialized ? '成功' : '失敗'}`);

    if (initialized) {
      // インスタンス追加テスト
      await loadBalancer.addInstance({
        id: 'instance-1',
        url: 'http://localhost:3001',
        weight: 1,
        health: 'HEALTHY',
        lastHealthCheck: new Date(),
        responseTime: 100,
        activeConnections: 0,
        maxConnections: 100,
        metadata: { region: 'us-east-1' },
      });

      await loadBalancer.addInstance({
        id: 'instance-2',
        url: 'http://localhost:3002',
        weight: 2,
        health: 'HEALTHY',
        lastHealthCheck: new Date(),
        responseTime: 150,
        activeConnections: 0,
        maxConnections: 100,
        metadata: { region: 'us-west-1' },
      });

      console.log('✅ インスタンス追加: 2個');

      // リクエスト分散テスト
      try {
        const request = {
          id: 'test-request-1',
          method: 'GET',
          url: '/api/test',
          headers: { 'Content-Type': 'application/json' },
          timestamp: new Date(),
          clientIp: '127.0.0.1',
          sessionId: 'test-session-1',
        };

        const response = await loadBalancer.distributeRequest(request);
        console.log(`✅ リクエスト分散: インスタンス=${response.instanceId}, レスポンス時間=${response.responseTime}ms`);
      } catch (error) {
        console.log('⚠️ リクエスト分散失敗（予想通り）');
      }

      // 統計取得テスト
      const stats = loadBalancer.getStats();
      console.log(`✅ 負荷分散器統計: 総リクエスト=${stats.totalRequests}, 成功=${stats.successfulRequests}, 失敗=${stats.failedRequests}`);

      // インスタンス一覧取得テスト
      const instances = loadBalancer.getInstances();
      console.log(`✅ インスタンス一覧: ${instances.length}個`);

      // インスタンス削除テスト
      await loadBalancer.removeInstance('instance-2');
      console.log('✅ インスタンス削除: instance-2');
    }

    console.log('✅ 負荷分散器テスト完了');
  } catch (error) {
    console.error('❌ 負荷分散器テストエラー:', error);
  }
}

async function testApplicationMonitor(): Promise<void> {
  console.log('\n🧪 アプリケーション監視テスト開始...');
  
  try {
    const applicationMonitor = new ApplicationMonitor({
      metrics: {
        enabled: true,
        collectionInterval: 10000,
        retentionPeriod: 7,
      },
      healthChecks: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
      },
      alerts: {
        enabled: true,
        rules: [
          {
            id: 'cpu-high',
            name: 'CPU使用率が高い',
            metric: 'cpu.usage',
            condition: 'GREATER_THAN',
            threshold: 80,
            severity: 'HIGH',
            enabled: true,
            cooldown: 300000,
          },
          {
            id: 'memory-high',
            name: 'メモリ使用率が高い',
            metric: 'memory.usage',
            condition: 'GREATER_THAN',
            threshold: 85,
            severity: 'HIGH',
            enabled: true,
            cooldown: 300000,
          },
        ],
      },
      reporting: {
        enabled: true,
        interval: 60000,
      },
    });

    // 監視開始テスト
    const started = await applicationMonitor.start();
    console.log(`✅ アプリケーション監視開始: ${started ? '成功' : '失敗'}`);

    if (started) {
      // メトリクス記録テスト
      applicationMonitor.recordMetric({
        name: 'test.metric',
        value: 50,
        unit: 'Count',
        tags: { instance: 'test' },
        timestamp: new Date(),
      });

      applicationMonitor.recordMetric({
        name: 'cpu.usage',
        value: 90, // アラートをトリガーする値
        unit: 'Percent',
        tags: { instance: 'test' },
        timestamp: new Date(),
      });

      console.log('✅ メトリクス記録: 2個');

      // ヘルスチェック追加テスト
      applicationMonitor.addHealthCheck('database', async () => ({
        status: 'PASS',
        message: 'Database connection OK',
      }));

      applicationMonitor.addHealthCheck('redis', async () => ({
        status: 'PASS',
        message: 'Redis connection OK',
      }));

      console.log('✅ ヘルスチェック追加: 2個');

      // ヘルスステータス取得テスト
      const healthStatus = await applicationMonitor.getHealthStatus();
      console.log(`✅ ヘルスステータス: ${healthStatus.status}, チェック数=${healthStatus.checks.length}`);

      // アラート取得テスト
      const alerts = applicationMonitor.getAlerts(false);
      console.log(`✅ アクティブアラート: ${alerts.length}個`);

      if (alerts.length > 0) {
        const alert = alerts[0];
        console.log(`  - アラート: ${alert.title} (${alert.severity})`);
        
        // アラート解決テスト
        applicationMonitor.resolveAlert(alert.id);
        console.log('✅ アラート解決');
      }

      // メトリクス取得テスト
      const metrics = applicationMonitor.getMetrics('test.metric');
      console.log(`✅ メトリクス取得: ${metrics.length}個`);

      // 統計取得テスト
      const stats = applicationMonitor.getStats();
      console.log(`✅ 監視統計: 稼働時間=${stats.uptime}ms, メトリクス数=${stats.metricsCount}, アラート数=${stats.activeAlertsCount}`);

      // 監視停止
      applicationMonitor.stop();
      console.log('✅ アプリケーション監視停止');
    }

    console.log('✅ アプリケーション監視テスト完了');
  } catch (error) {
    console.error('❌ アプリケーション監視テストエラー:', error);
  }
}

async function testAuthManager(): Promise<void> {
  console.log('\n🧪 認証管理テスト開始...');
  
  try {
    const authManager = new AuthManager({
      jwt: {
        secret: 'test-secret-key',
        expiresIn: '1h',
        refreshExpiresIn: '7d',
        issuer: 'test-app',
        audience: 'test-users',
      },
      password: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: false,
      },
      session: {
        maxSessions: 5,
        sessionTimeout: 3600000,
        rememberMeDuration: 2592000000,
      },
      mfa: {
        enabled: true,
        issuer: 'TestApp',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      },
      security: {
        maxLoginAttempts: 5,
        lockoutDuration: 300000,
        requireEmailVerification: false,
        passwordResetExpiry: 3600000,
      },
    });

    // 初期化テスト
    const initialized = await authManager.initialize();
    console.log(`✅ 認証管理初期化: ${initialized ? '成功' : '失敗'}`);

    if (initialized) {
      // 認証テスト
      const authResult = await authManager.authenticate({
        email: 'admin@example.com',
        password: 'admin123',
      });

      console.log(`✅ 認証テスト: ${authResult.success ? '成功' : '失敗'}`);
      
      if (authResult.success && authResult.user && authResult.token) {
        console.log(`  - ユーザー: ${authResult.user.email} (${authResult.user.role})`);
        console.log(`  - トークン: ${authResult.token.substring(0, 20)}...`);

        // トークン検証テスト
        const verifyResult = await authManager.verifyToken(authResult.token);
        console.log(`✅ トークン検証: ${verifyResult.valid ? '成功' : '失敗'}`);

        if (verifyResult.valid && verifyResult.user) {
          // 認可テスト
          const canTrade = await authManager.authorize(verifyResult.user, 'trading', 'write');
          const canViewReports = await authManager.authorize(verifyResult.user, 'reports', 'read');
          const canAdmin = await authManager.authorize(verifyResult.user, 'admin', 'write');

          console.log(`✅ 認可テスト: 取引=${canTrade}, レポート閲覧=${canViewReports}, 管理=${canAdmin}`);

          // MFA有効化テスト
          const mfaSetup = await authManager.enableMFA(verifyResult.user.id);
          console.log(`✅ MFA有効化: シークレット=${mfaSetup.secret.substring(0, 10)}..., バックアップコード数=${mfaSetup.backupCodes.length}`);

          // MFA無効化テスト
          await authManager.disableMFA(verifyResult.user.id);
          console.log('✅ MFA無効化');
        }
      }

      // ユーザー作成テスト
      const newUser = await authManager.createUser({
        email: 'test@example.com',
        username: 'testuser',
        role: 'VIEWER',
        permissions: ['portfolio:read'],
        isActive: true,
      }, 'testpassword123');

      console.log(`✅ ユーザー作成: ${newUser.email} (${newUser.role})`);

      // 全ユーザー取得テスト
      const allUsers = authManager.getAllUsers();
      console.log(`✅ 全ユーザー取得: ${allUsers.length}個`);

      // セッション取得テスト
      const sessions = authManager.getAllSessions();
      console.log(`✅ 全セッション取得: ${sessions.length}個`);

      if (sessions.length > 0) {
        // セッション無効化テスト
        authManager.invalidateSession(sessions[0].id);
        console.log('✅ セッション無効化');
      }
    }

    console.log('✅ 認証管理テスト完了');
  } catch (error) {
    console.error('❌ 認証管理テストエラー:', error);
  }
}

async function testIntegrationWorkflow(): Promise<void> {
  console.log('\n🧪 統合ワークフローテスト開始...');
  
  try {
    // AWS統合
    const awsIntegration = new AWSIntegration({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      s3: { bucket: 'test-bucket', region: 'us-east-1' },
      rds: { endpoint: 'test-endpoint', port: 5432, database: 'test-db', username: 'test-user', password: 'test-password' },
      lambda: { region: 'us-east-1', functions: { 'test-function': 'test-function-name' } },
      cloudWatch: { namespace: 'TestApp', region: 'us-east-1' },
    });

    // 負荷分散器
    const loadBalancer = new LoadBalancer({
      strategy: { name: 'ROUND_ROBIN', parameters: {} },
      healthCheck: { enabled: true, interval: 30000, timeout: 5000, path: '/health', expectedStatus: 200, retries: 3 },
      maxRetries: 3,
      retryDelay: 1000,
      circuitBreaker: { enabled: true, failureThreshold: 5, recoveryTimeout: 60000 },
      stickySession: { enabled: true, cookieName: 'session-id', maxAge: 3600000 },
    });

    // アプリケーション監視
    const applicationMonitor = new ApplicationMonitor({
      metrics: { enabled: true, collectionInterval: 10000, retentionPeriod: 7 },
      healthChecks: { enabled: true, interval: 30000, timeout: 5000 },
      alerts: { enabled: true, rules: [] },
      reporting: { enabled: true, interval: 60000 },
    });

    // 認証管理
    const authManager = new AuthManager({
      jwt: { secret: 'test-secret-key', expiresIn: '1h', refreshExpiresIn: '7d', issuer: 'test-app', audience: 'test-users' },
      password: { minLength: 8, requireUppercase: true, requireLowercase: true, requireNumbers: true, requireSpecialChars: false },
      session: { maxSessions: 5, sessionTimeout: 3600000, rememberMeDuration: 2592000000 },
      mfa: { enabled: true, issuer: 'TestApp', algorithm: 'SHA1', digits: 6, period: 30 },
      security: { maxLoginAttempts: 5, lockoutDuration: 300000, requireEmailVerification: false, passwordResetExpiry: 3600000 },
    });

    // 統合ワークフロー実行
    console.log('🔄 統合ワークフロー実行中...');

    // 1. サービス初期化
    const awsInitialized = await awsIntegration.initialize();
    const lbInitialized = await loadBalancer.initialize();
    const monitorStarted = await applicationMonitor.start();
    const authInitialized = await authManager.initialize();

    console.log(`✅ サービス初期化: AWS=${awsInitialized}, LB=${lbInitialized}, Monitor=${monitorStarted}, Auth=${authInitialized}`);

    // 2. インスタンス追加
    if (lbInitialized) {
      await loadBalancer.addInstance({
        id: 'instance-1',
        url: 'http://localhost:3001',
        weight: 1,
        health: 'HEALTHY',
        lastHealthCheck: new Date(),
        responseTime: 100,
        activeConnections: 0,
        maxConnections: 100,
        metadata: { region: 'us-east-1' },
      });
      console.log('✅ インスタンス追加');
    }

    // 3. メトリクス記録
    if (monitorStarted) {
      applicationMonitor.recordMetric({
        name: 'integration.test',
        value: 100,
        unit: 'Count',
        tags: { service: 'integration' },
        timestamp: new Date(),
      });
      console.log('✅ メトリクス記録');
    }

    // 4. 認証テスト
    if (authInitialized) {
      const authResult = await authManager.authenticate({
        email: 'admin@example.com',
        password: 'admin123',
      });
      console.log(`✅ 認証テスト: ${authResult.success ? '成功' : '失敗'}`);
    }

    // 5. 統計取得
    const lbStats = loadBalancer.getStats();
    const monitorStats = applicationMonitor.getStats();
    const authUsers = authManager.getAllUsers();

    console.log(`✅ 統計取得:`);
    console.log(`  - 負荷分散器: 総リクエスト=${lbStats.totalRequests}, アクティブインスタンス=${lbStats.activeInstances}`);
    console.log(`  - 監視: 稼働時間=${monitorStats.uptime}ms, メトリクス数=${monitorStats.metricsCount}`);
    console.log(`  - 認証: ユーザー数=${authUsers.length}`);

    // 6. サービス停止
    awsIntegration.stop();
    loadBalancer.stop();
    applicationMonitor.stop();
    authManager.stop();
    console.log('✅ 全サービス停止');

    console.log('✅ 統合ワークフローテスト完了');
  } catch (error) {
    console.error('❌ 統合ワークフローテストエラー:', error);
  }
}

async function runAllTests(): Promise<void> {
  console.log('🚀 Phase4機能テスト開始...');
  
  try {
    await testAWSIntegration();
    await testLoadBalancer();
    await testApplicationMonitor();
    await testAuthManager();
    await testIntegrationWorkflow();
    
    console.log('\n✅ Phase4機能テスト完了');
  } catch (error) {
    console.error('❌ Phase4機能テストエラー:', error);
  }
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}
