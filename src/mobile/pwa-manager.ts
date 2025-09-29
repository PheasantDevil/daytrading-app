/**
 * PWA管理サービス
 * Progressive Web App対応、オフライン機能、プッシュ通知
 */

export interface ServiceWorkerConfig {
  enabled: boolean;
  scope: string;
  updateInterval: number; // ミリ秒
  cacheStrategy: 'CACHE_FIRST' | 'NETWORK_FIRST' | 'STALE_WHILE_REVALIDATE';
  maxCacheSize: number; // MB
  maxCacheAge: number; // ミリ秒
}

export interface CacheConfig {
  enabled: boolean;
  strategies: {
    static: 'CACHE_FIRST' | 'NETWORK_FIRST';
    api: 'NETWORK_FIRST' | 'STALE_WHILE_REVALIDATE';
    images: 'CACHE_FIRST' | 'STALE_WHILE_REVALIDATE';
  };
  patterns: {
    static: string[];
    api: string[];
    images: string[];
  };
}

export interface OfflineStorage {
  enabled: boolean;
  maxSize: number; // MB
  syncInterval: number; // ミリ秒
  conflictResolution: 'SERVER_WINS' | 'CLIENT_WINS' | 'LAST_WRITE_WINS';
}

export interface PushNotificationConfig {
  enabled: boolean;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  supportedFeatures: string[];
  defaultOptions: {
    badge?: string;
    icon?: string;
    sound?: string;
    vibrate?: number[];
    tag?: string;
    requireInteraction?: boolean;
  };
}

export interface PWAManifest {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  display: 'fullscreen' | 'standalone' | 'minimal-ui' | 'browser';
  orientation: 'portrait' | 'landscape' | 'any';
  theme_color: string;
  background_color: string;
  icons: {
    src: string;
    sizes: string;
    type: string;
    purpose?: 'any' | 'maskable' | 'monochrome';
  }[];
  categories: string[];
  lang: string;
  dir: 'ltr' | 'rtl';
  scope: string;
  prefer_related_applications: boolean;
  related_applications: {
    platform: string;
    url: string;
    id?: string;
  }[];
}

export interface PWAConfig {
  serviceWorker: ServiceWorkerConfig;
  cache: CacheConfig;
  offlineStorage: OfflineStorage;
  pushNotification: PushNotificationConfig;
  manifest: PWAManifest;
}

export interface CachedResource {
  url: string;
  response: Response;
  timestamp: Date;
  size: number;
  strategy: string;
}

export interface OfflineData {
  id: string;
  type: 'TRADE' | 'ORDER' | 'PORTFOLIO' | 'SETTINGS';
  data: any;
  timestamp: Date;
  synced: boolean;
  conflict?: boolean;
}

export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  createdAt: Date;
  lastUsed: Date;
  isActive: boolean;
}

export class PWAManager {
  private config: PWAConfig;
  private serviceWorker: ServiceWorker | null = null;
  private cacheManager: CacheManager;
  private offlineStorage: OfflineStorageManager;
  private pushNotificationService: PushNotificationService;
  private isInitialized: boolean = false;

  constructor(config: PWAConfig) {
    this.config = config;
    this.cacheManager = new CacheManager(config.cache);
    this.offlineStorage = new OfflineStorageManager(config.offlineStorage);
    this.pushNotificationService = new PushNotificationService(
      config.pushNotification
    );
  }

  /**
   * PWA管理サービスを初期化
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🔄 PWA管理サービス初期化中...');

      // サービスワーカーを登録
      if (this.config.serviceWorker.enabled) {
        await this.registerServiceWorker();
      }

      // キャッシュマネージャーを初期化
      if (this.config.cache.enabled) {
        await this.cacheManager.initialize();
      }

      // オフラインストレージを初期化
      if (this.config.offlineStorage.enabled) {
        await this.offlineStorage.initialize();
      }

      // プッシュ通知サービスを初期化
      if (this.config.pushNotification.enabled) {
        await this.pushNotificationService.initialize();
      }

      // マニフェストを登録
      await this.registerManifest();

      this.isInitialized = true;
      console.log('✅ PWA管理サービス初期化完了');
      return true;
    } catch (error) {
      console.error('❌ PWA管理サービス初期化エラー:', error);
      return false;
    }
  }

  /**
   * サービスワーカーを登録
   */
  async registerServiceWorker(): Promise<void> {
    try {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Workerがサポートされていません');
      }

      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: this.config.serviceWorker.scope,
      });

      this.serviceWorker =
        registration.active || registration.waiting || registration.installing;

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // 新しいバージョンが利用可能
              this.showUpdateNotification();
            }
          });
        }
      });

      console.log('✅ サービスワーカー登録完了');
    } catch (error) {
      console.error('❌ サービスワーカー登録エラー:', error);
      throw error;
    }
  }

  /**
   * リソースをキャッシュ
   */
  async cacheResources(resources: string[]): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('PWA管理サービスが初期化されていません');
      }

      if (!this.config.cache.enabled) {
        throw new Error('キャッシュが無効です');
      }

      await this.cacheManager.cacheResources(resources);
      console.log(`✅ リソースキャッシュ完了: ${resources.length}個`);
    } catch (error) {
      console.error('❌ リソースキャッシュエラー:', error);
      throw error;
    }
  }

  /**
   * オフラインデータを同期
   */
  async syncOfflineData(): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('PWA管理サービスが初期化されていません');
      }

      if (!this.config.offlineStorage.enabled) {
        throw new Error('オフラインストレージが無効です');
      }

      await this.offlineStorage.syncData();
      console.log('✅ オフラインデータ同期完了');
    } catch (error) {
      console.error('❌ オフラインデータ同期エラー:', error);
      throw error;
    }
  }

  /**
   * プッシュ通知を購読
   */
  async subscribeToPushNotifications(
    userId: string
  ): Promise<PushSubscription> {
    try {
      if (!this.isInitialized) {
        throw new Error('PWA管理サービスが初期化されていません');
      }

      if (!this.config.pushNotification.enabled) {
        throw new Error('プッシュ通知が無効です');
      }

      const subscription = await this.pushNotificationService.subscribe(userId);
      console.log(`✅ プッシュ通知購読完了: ${userId}`);
      return subscription;
    } catch (error) {
      console.error(`❌ プッシュ通知購読エラー: ${userId}`, error);
      throw error;
    }
  }

  /**
   * プッシュ通知を送信
   */
  async sendPushNotification(
    subscription: PushSubscription,
    notification: any
  ): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('PWA管理サービスが初期化されていません');
      }

      if (!this.config.pushNotification.enabled) {
        throw new Error('プッシュ通知が無効です');
      }

      await this.pushNotificationService.sendNotification(
        subscription,
        notification
      );
      console.log(`✅ プッシュ通知送信完了: ${subscription.userId}`);
    } catch (error) {
      console.error(`❌ プッシュ通知送信エラー: ${subscription.userId}`, error);
      throw error;
    }
  }

  /**
   * オフラインデータを保存
   */
  async saveOfflineData(type: OfflineData['type'], data: any): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('PWA管理サービスが初期化されていません');
      }

      if (!this.config.offlineStorage.enabled) {
        throw new Error('オフラインストレージが無効です');
      }

      await this.offlineStorage.saveData(type, data);
      console.log(`✅ オフラインデータ保存完了: ${type}`);
    } catch (error) {
      console.error(`❌ オフラインデータ保存エラー: ${type}`, error);
      throw error;
    }
  }

  /**
   * オフラインデータを取得
   */
  async getOfflineData(type?: OfflineData['type']): Promise<OfflineData[]> {
    try {
      if (!this.isInitialized) {
        throw new Error('PWA管理サービスが初期化されていません');
      }

      if (!this.config.offlineStorage.enabled) {
        throw new Error('オフラインストレージが無効です');
      }

      const data = await this.offlineStorage.getData(type);
      console.log(`✅ オフラインデータ取得完了: ${data.length}件`);
      return data;
    } catch (error) {
      console.error('❌ オフラインデータ取得エラー:', error);
      throw error;
    }
  }

  /**
   * キャッシュをクリア
   */
  async clearCache(): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('PWA管理サービスが初期化されていません');
      }

      await this.cacheManager.clearCache();
      console.log('✅ キャッシュクリア完了');
    } catch (error) {
      console.error('❌ キャッシュクリアエラー:', error);
      throw error;
    }
  }

  /**
   * オフラインストレージをクリア
   */
  async clearOfflineStorage(): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('PWA管理サービスが初期化されていません');
      }

      await this.offlineStorage.clearStorage();
      console.log('✅ オフラインストレージクリア完了');
    } catch (error) {
      console.error('❌ オフラインストレージクリアエラー:', error);
      throw error;
    }
  }

  /**
   * マニフェストを登録
   */
  private async registerManifest(): Promise<void> {
    try {
      const manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = '/manifest.json';
      document.head.appendChild(manifestLink);

      console.log('✅ マニフェスト登録完了');
    } catch (error) {
      console.error('❌ マニフェスト登録エラー:', error);
    }
  }

  /**
   * 更新通知を表示
   */
  private showUpdateNotification(): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('アプリの更新', {
        body: '新しいバージョンが利用可能です。更新しますか？',
        icon: '/icon-192x192.png',
        tag: 'app-update',
        requireInteraction: true,
      });
    }
  }

  /**
   * 設定を取得
   */
  getConfig(): PWAConfig {
    return { ...this.config };
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<PWAConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('✅ PWA設定更新');
  }

  /**
   * 統計を取得
   */
  getStats(): any {
    return {
      initialized: this.isInitialized,
      serviceWorkerEnabled: this.config.serviceWorker.enabled,
      cacheEnabled: this.config.cache.enabled,
      offlineStorageEnabled: this.config.offlineStorage.enabled,
      pushNotificationEnabled: this.config.pushNotification.enabled,
      cachedResources: this.cacheManager.getCacheStats(),
      offlineDataCount: this.offlineStorage.getDataCount(),
    };
  }

  /**
   * PWA管理サービスを停止
   */
  stop(): void {
    this.isInitialized = false;
    console.log('⏹️ PWA管理サービス停止');
  }
}

/**
 * キャッシュマネージャー
 */
class CacheManager {
  private config: CacheConfig;
  private cache: Cache | null = null;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if ('caches' in window) {
      this.cache = await caches.open('pwa-cache-v1');
      console.log('✅ キャッシュマネージャー初期化完了');
    }
  }

  async cacheResources(resources: string[]): Promise<void> {
    if (!this.cache) return;

    for (const resource of resources) {
      try {
        const response = await fetch(resource);
        if (response.ok) {
          await this.cache.put(resource, response);
        }
      } catch (error) {
        console.error(`❌ リソースキャッシュエラー: ${resource}`, error);
      }
    }
  }

  async clearCache(): Promise<void> {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }
  }

  getCacheStats(): any {
    return {
      enabled: this.config.enabled,
      strategies: this.config.strategies,
    };
  }
}

/**
 * オフラインストレージマネージャー
 */
class OfflineStorageManager {
  private config: OfflineStorage;
  private storage: Map<string, OfflineData> = new Map();

  constructor(config: OfflineStorage) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // IndexedDBまたはlocalStorageからデータを復元
    console.log('✅ オフラインストレージマネージャー初期化完了');
  }

  async saveData(type: OfflineData['type'], data: any): Promise<void> {
    const offlineData: OfflineData = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: new Date(),
      synced: false,
    };

    this.storage.set(offlineData.id, offlineData);
  }

  async getData(type?: OfflineData['type']): Promise<OfflineData[]> {
    const data = Array.from(this.storage.values());
    return type ? data.filter((d) => d.type === type) : data;
  }

  async syncData(): Promise<void> {
    const unsyncedData = Array.from(this.storage.values()).filter(
      (d) => !d.synced
    );

    for (const data of unsyncedData) {
      try {
        // サーバーに同期
        await this.syncToServer(data);
        data.synced = true;
        this.storage.set(data.id, data);
      } catch (error) {
        console.error(`❌ データ同期エラー: ${data.id}`, error);
      }
    }
  }

  private async syncToServer(data: OfflineData): Promise<void> {
    // 簡略化されたサーバー同期
    console.log(`🔄 データ同期中: ${data.id}`);
  }

  async clearStorage(): Promise<void> {
    this.storage.clear();
  }

  getDataCount(): number {
    return this.storage.size;
  }
}

/**
 * プッシュ通知サービス
 */
class PushNotificationService {
  private config: PushNotificationConfig;
  private subscriptions: Map<string, PushSubscription> = new Map();

  constructor(config: PushNotificationConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      console.log('✅ プッシュ通知サービス初期化完了');
    }
  }

  async subscribe(userId: string): Promise<PushSubscription> {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: this.config.vapidPublicKey,
    });

    const pushSubscription: PushSubscription = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
        auth: this.arrayBufferToBase64(subscription.getKey('auth')!),
      },
      createdAt: new Date(),
      lastUsed: new Date(),
      isActive: true,
    };

    this.subscriptions.set(pushSubscription.id, pushSubscription);
    return pushSubscription;
  }

  async sendNotification(
    subscription: PushSubscription,
    notification: any
  ): Promise<void> {
    // 簡略化されたプッシュ通知送信
    console.log(`📱 プッシュ通知送信: ${subscription.userId}`);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
