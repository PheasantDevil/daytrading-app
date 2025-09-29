/**
 * AWS統合サービス
 * AWSサービスとの統合を管理
 */

import AWS from 'aws-sdk';

export interface AWSConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  s3: {
    bucket: string;
    region: string;
  };
  rds: {
    endpoint: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
  lambda: {
    region: string;
    functions: {
      [key: string]: string;
    };
  };
  cloudWatch: {
    namespace: string;
    region: string;
  };
}

export interface S3Object {
  key: string;
  bucket: string;
  body: Buffer | string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface RDSQuery {
  query: string;
  parameters?: any[];
  timeout?: number;
}

export interface LambdaInvocation {
  functionName: string;
  payload: any;
  invocationType?: 'RequestResponse' | 'Event' | 'DryRun';
  timeout?: number;
}

export interface CloudWatchMetric {
  namespace: string;
  metricName: string;
  value: number;
  unit: 'Count' | 'Bytes' | 'Seconds' | 'Percent';
  dimensions?: Record<string, string>;
  timestamp?: Date;
}

export interface CloudWatchLog {
  logGroupName: string;
  logStreamName: string;
  message: string;
  timestamp?: Date;
}

export class AWSIntegration {
  private config: AWSConfig;
  private s3: AWS.S3;
  private rds: AWS.RDSDataService;
  private lambda: AWS.Lambda;
  private cloudWatch: AWS.CloudWatch;
  private cloudWatchLogs: AWS.CloudWatchLogs;
  private isInitialized: boolean = false;

  constructor(config: AWSConfig) {
    this.config = config;
    
    // AWS設定
    AWS.config.update({
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    });

    // サービス初期化
    this.s3 = new AWS.S3({ region: config.s3.region });
    this.rds = new AWS.RDSDataService({ region: config.region });
    this.lambda = new AWS.Lambda({ region: config.lambda.region });
    this.cloudWatch = new AWS.CloudWatch({ region: config.cloudWatch.region });
    this.cloudWatchLogs = new AWS.CloudWatchLogs({ region: config.cloudWatch.region });
  }

  /**
   * AWS統合を初期化
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🔄 AWS統合初期化中...');

      // S3バケットの存在確認
      await this.checkS3Bucket();
      
      // RDS接続テスト
      await this.testRDSConnection();
      
      // Lambda関数の存在確認
      await this.checkLambdaFunctions();

      this.isInitialized = true;
      console.log('✅ AWS統合初期化完了');
      return true;
    } catch (error) {
      console.error('❌ AWS統合初期化エラー:', error);
      return false;
    }
  }

  /**
   * S3バケットの存在確認
   */
  private async checkS3Bucket(): Promise<void> {
    try {
      await this.s3.headBucket({ Bucket: this.config.s3.bucket }).promise();
      console.log(`✅ S3バケット確認: ${this.config.s3.bucket}`);
    } catch (error) {
      console.error(`❌ S3バケット確認エラー: ${this.config.s3.bucket}`, error);
      throw error;
    }
  }

  /**
   * RDS接続テスト
   */
  private async testRDSConnection(): Promise<void> {
    try {
      const result = await this.rds.executeStatement({
        resourceArn: this.config.rds.endpoint,
        secretArn: this.config.rds.password,
        database: this.config.rds.database,
        sql: 'SELECT 1 as test',
      }).promise();
      
      console.log('✅ RDS接続テスト成功');
    } catch (error) {
      console.error('❌ RDS接続テストエラー:', error);
      throw error;
    }
  }

  /**
   * Lambda関数の存在確認
   */
  private async checkLambdaFunctions(): Promise<void> {
    try {
      for (const [name, functionName] of Object.entries(this.config.lambda.functions)) {
        await this.lambda.getFunction({ FunctionName: functionName }).promise();
        console.log(`✅ Lambda関数確認: ${name} -> ${functionName}`);
      }
    } catch (error) {
      console.error('❌ Lambda関数確認エラー:', error);
      throw error;
    }
  }

  /**
   * S3にオブジェクトをアップロード
   */
  async uploadToS3(object: S3Object): Promise<string> {
    try {
      if (!this.isInitialized) {
        throw new Error('AWS統合が初期化されていません');
      }

      const params: AWS.S3.PutObjectRequest = {
        Bucket: object.bucket || this.config.s3.bucket,
        Key: object.key,
        Body: object.body,
        ContentType: object.contentType || 'application/octet-stream',
        Metadata: object.metadata || {},
      };

      const result = await this.s3.upload(params).promise();
      console.log(`✅ S3アップロード成功: ${object.key}`);
      return result.Location;
    } catch (error) {
      console.error(`❌ S3アップロードエラー: ${object.key}`, error);
      throw error;
    }
  }

  /**
   * S3からオブジェクトをダウンロード
   */
  async downloadFromS3(bucket: string, key: string): Promise<Buffer> {
    try {
      if (!this.isInitialized) {
        throw new Error('AWS統合が初期化されていません');
      }

      const params: AWS.S3.GetObjectRequest = {
        Bucket: bucket || this.config.s3.bucket,
        Key: key,
      };

      const result = await this.s3.getObject(params).promise();
      console.log(`✅ S3ダウンロード成功: ${key}`);
      return result.Body as Buffer;
    } catch (error) {
      console.error(`❌ S3ダウンロードエラー: ${key}`, error);
      throw error;
    }
  }

  /**
   * S3オブジェクトを削除
   */
  async deleteFromS3(bucket: string, key: string): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('AWS統合が初期化されていません');
      }

      const params: AWS.S3.DeleteObjectRequest = {
        Bucket: bucket || this.config.s3.bucket,
        Key: key,
      };

      await this.s3.deleteObject(params).promise();
      console.log(`✅ S3削除成功: ${key}`);
    } catch (error) {
      console.error(`❌ S3削除エラー: ${key}`, error);
      throw error;
    }
  }

  /**
   * RDSでクエリを実行
   */
  async executeRDSQuery(query: RDSQuery): Promise<any[]> {
    try {
      if (!this.isInitialized) {
        throw new Error('AWS統合が初期化されていません');
      }

      const params: AWS.RDSDataService.ExecuteStatementRequest = {
        resourceArn: this.config.rds.endpoint,
        secretArn: this.config.rds.password,
        database: this.config.rds.database,
        sql: query.query,
        parameters: query.parameters || [],
      };

      const result = await this.rds.executeStatement(params).promise();
      console.log(`✅ RDSクエリ実行成功: ${query.query.substring(0, 50)}...`);
      return result.records || [];
    } catch (error) {
      console.error(`❌ RDSクエリ実行エラー: ${query.query}`, error);
      throw error;
    }
  }

  /**
   * Lambda関数を実行
   */
  async invokeLambda(invocation: LambdaInvocation): Promise<any> {
    try {
      if (!this.isInitialized) {
        throw new Error('AWS統合が初期化されていません');
      }

      const functionName = this.config.lambda.functions[invocation.functionName] || invocation.functionName;
      
      const params: AWS.Lambda.InvocationRequest = {
        FunctionName: functionName,
        Payload: JSON.stringify(invocation.payload),
        InvocationType: invocation.invocationType || 'RequestResponse',
      };

      const result = await this.lambda.invoke(params).promise();
      console.log(`✅ Lambda実行成功: ${invocation.functionName}`);
      
      if (result.Payload) {
        return JSON.parse(result.Payload.toString());
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Lambda実行エラー: ${invocation.functionName}`, error);
      throw error;
    }
  }

  /**
   * CloudWatchにメトリクスを送信
   */
  async publishMetric(metric: CloudWatchMetric): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('AWS統合が初期化されていません');
      }

      const params: AWS.CloudWatch.PutMetricDataRequest = {
        Namespace: metric.namespace || this.config.cloudWatch.namespace,
        MetricData: [
          {
            MetricName: metric.metricName,
            Value: metric.value,
            Unit: metric.unit,
            Dimensions: Object.entries(metric.dimensions || {}).map(([Name, Value]) => ({ Name, Value })),
            Timestamp: metric.timestamp || new Date(),
          },
        ],
      };

      await this.cloudWatch.putMetricData(params).promise();
      console.log(`✅ CloudWatchメトリクス送信成功: ${metric.metricName}`);
    } catch (error) {
      console.error(`❌ CloudWatchメトリクス送信エラー: ${metric.metricName}`, error);
      throw error;
    }
  }

  /**
   * CloudWatch Logsにログを送信
   */
  async publishLog(log: CloudWatchLog): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('AWS統合が初期化されていません');
      }

      const params: AWS.CloudWatchLogs.PutLogEventsRequest = {
        logGroupName: log.logGroupName,
        logStreamName: log.logStreamName,
        logEvents: [
          {
            message: log.message,
            timestamp: (log.timestamp || new Date()).getTime(),
          },
        ],
      };

      await this.cloudWatchLogs.putLogEvents(params).promise();
      console.log(`✅ CloudWatch Logs送信成功: ${log.logStreamName}`);
    } catch (error) {
      console.error(`❌ CloudWatch Logs送信エラー: ${log.logStreamName}`, error);
      throw error;
    }
  }

  /**
   * 複数のメトリクスを一括送信
   */
  async publishMetrics(metrics: CloudWatchMetric[]): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('AWS統合が初期化されていません');
      }

      const params: AWS.CloudWatch.PutMetricDataRequest = {
        Namespace: this.config.cloudWatch.namespace,
        MetricData: metrics.map(metric => ({
          MetricName: metric.metricName,
          Value: metric.value,
          Unit: metric.unit,
          Dimensions: Object.entries(metric.dimensions || {}).map(([Name, Value]) => ({ Name, Value })),
          Timestamp: metric.timestamp || new Date(),
        })),
      };

      await this.cloudWatch.putMetricData(params).promise();
      console.log(`✅ CloudWatchメトリクス一括送信成功: ${metrics.length}個`);
    } catch (error) {
      console.error('❌ CloudWatchメトリクス一括送信エラー:', error);
      throw error;
    }
  }

  /**
   * S3オブジェクトの一覧を取得
   */
  async listS3Objects(bucket: string, prefix?: string): Promise<AWS.S3.Object[]> {
    try {
      if (!this.isInitialized) {
        throw new Error('AWS統合が初期化されていません');
      }

      const params: AWS.S3.ListObjectsV2Request = {
        Bucket: bucket || this.config.s3.bucket,
        Prefix: prefix || '',
      };

      const result = await this.s3.listObjectsV2(params).promise();
      console.log(`✅ S3オブジェクト一覧取得成功: ${result.Contents?.length || 0}個`);
      return result.Contents || [];
    } catch (error) {
      console.error('❌ S3オブジェクト一覧取得エラー:', error);
      throw error;
    }
  }

  /**
   * CloudWatchメトリクスの統計を取得
   */
  async getMetricStatistics(
    metricName: string,
    startTime: Date,
    endTime: Date,
    period: number = 300,
    statistics: string[] = ['Average']
  ): Promise<AWS.CloudWatch.Datapoint[]> {
    try {
      if (!this.isInitialized) {
        throw new Error('AWS統合が初期化されていません');
      }

      const params: AWS.CloudWatch.GetMetricStatisticsRequest = {
        Namespace: this.config.cloudWatch.namespace,
        MetricName: metricName,
        StartTime: startTime,
        EndTime: endTime,
        Period: period,
        Statistics: statistics as AWS.CloudWatch.Statistic[],
      };

      const result = await this.cloudWatch.getMetricStatistics(params).promise();
      console.log(`✅ CloudWatchメトリクス統計取得成功: ${metricName}`);
      return result.Datapoints || [];
    } catch (error) {
      console.error(`❌ CloudWatchメトリクス統計取得エラー: ${metricName}`, error);
      throw error;
    }
  }

  /**
   * AWS統合の状態を取得
   */
  getStatus(): { initialized: boolean; services: Record<string, boolean> } {
    return {
      initialized: this.isInitialized,
      services: {
        s3: !!this.s3,
        rds: !!this.rds,
        lambda: !!this.lambda,
        cloudWatch: !!this.cloudWatch,
        cloudWatchLogs: !!this.cloudWatchLogs,
      },
    };
  }

  /**
   * AWS統合を停止
   */
  stop(): void {
    this.isInitialized = false;
    console.log('⏹️ AWS統合停止');
  }
}
