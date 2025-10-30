'use client';

import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useState } from 'react';

interface SystemSettings {
  // Interactive Brokers設定
  ibHost: string;
  ibPort: number;
  ibClientId: number;
  ibAccountId: string;
  ibPaperTrading: boolean;

  // 取引設定
  maxDailyLoss: number;
  maxPositionSize: number;
  stopLossPercent: number;
  takeProfitPercent: number;

  // 通知設定
  emailNotifications: boolean;
  lineNotifications: boolean;
  slackNotifications: boolean;

  // データ設定
  dataRefreshInterval: number;
  maxDataRetentionDays: number;

  // セキュリティ設定
  twoFactorAuth: boolean;
  sessionTimeout: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    // Interactive Brokers設定
    ibHost: '127.0.0.1',
    ibPort: 7496,
    ibClientId: 1,
    ibAccountId: '',
    ibPaperTrading: false,

    // 取引設定
    maxDailyLoss: 50000,
    maxPositionSize: 100000,
    stopLossPercent: 3,
    takeProfitPercent: 5,

    // 通知設定
    emailNotifications: true,
    lineNotifications: false,
    slackNotifications: false,

    // データ設定
    dataRefreshInterval: 5000,
    maxDataRetentionDays: 30,

    // セキュリティ設定
    twoFactorAuth: false,
    sessionTimeout: 30,
  });

  const [activeTab, setActiveTab] = useState('broker');
  // ポート選択UI用の状態
  const [portMode, setPortMode] = useState<'live' | 'paper' | 'other'>(
    settings.ibPort === 7496
      ? 'live'
      : settings.ibPort === 7497
        ? 'paper'
        : 'other'
  );
  const [customPort, setCustomPort] = useState<number>(
    settings.ibPort === 7496 || settings.ibPort === 7497
      ? 4002
      : settings.ibPort
  );
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    error?: string;
    port?: number;
    host?: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  const handleSettingChange = (key: keyof SystemSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        alert('設定を保存しました');
      } else {
        alert('設定の保存に失敗しました');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('設定の保存に失敗しました');
    }
  };

  const testConnection = async () => {
    try {
      setTesting(true);
      setConnectionResult(null);
      const response = await fetch('/api/brokers/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: settings.ibHost,
          port: settings.ibPort,
          clientId: settings.ibClientId,
        }),
      });

      const json = await response.json().catch(() => ({}));
      if (response.ok) {
        setConnectionResult({
          success: true,
          message: json?.message || '接続に成功しました',
          latencyMs: json?.data?.latencyMs,
          port: json?.data?.port ?? settings.ibPort,
          host: json?.data?.host ?? settings.ibHost,
        });
      } else {
        setConnectionResult({
          success: false,
          message: json?.message || '接続に失敗しました',
          error: json?.data?.error || json?.error,
          port: json?.data?.port ?? settings.ibPort,
          host: json?.data?.host ?? settings.ibHost,
        });
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionResult({
        success: false,
        message: '接続テストが失敗しました',
        error: error instanceof Error ? error.message : 'Unknown error',
        port: settings.ibPort,
        host: settings.ibHost,
      });
    } finally {
      setTesting(false);
    }
  };

  const tabs = [
    { id: 'broker', name: 'ブローカー設定', icon: '🏦' },
    { id: 'trading', name: '取引設定', icon: '📈' },
    { id: 'notifications', name: '通知設定', icon: '🔔' },
    { id: 'data', name: 'データ設定', icon: '💾' },
    { id: 'security', name: 'セキュリティ', icon: '🔒' },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">システム設定</h1>
          <p className="text-gray-600">
            トレーディングプラットフォームの各種設定を行います
          </p>
        </div>

        {/* タブナビゲーション */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* 設定フォーム */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Interactive Brokers設定 */}
          {activeTab === 'broker' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">
                Interactive Brokers設定
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    TWS/Gateway ホスト
                  </label>
                  <input
                    type="text"
                    value={settings.ibHost}
                    onChange={(e) =>
                      handleSettingChange('ibHost', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="127.0.0.1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ポート番号
                  </label>
                  <div className="flex gap-3">
                    <select
                      value={portMode}
                      onChange={(e) => {
                        const mode = e.target.value as
                          | 'live'
                          | 'paper'
                          | 'other';
                        setPortMode(mode);
                        if (mode === 'live') {
                          handleSettingChange('ibPort', 7496);
                        } else if (mode === 'paper') {
                          handleSettingChange('ibPort', 7497);
                        } else {
                          // その他: 右枠に自動入力（デフォルト4002）
                          const nextPort = customPort || 4002;
                          setCustomPort(nextPort);
                          handleSettingChange('ibPort', nextPort);
                        }
                      }}
                      className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="live">7496 (本番取引)</option>
                      <option value="paper">
                        7497 (ペーパートレーディング)
                      </option>
                      <option value="other">その他（右枠に自動入力）</option>
                    </select>
                    <input
                      type="number"
                      value={
                        portMode === 'other' ? customPort : settings.ibPort
                      }
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setCustomPort(v);
                        if (portMode === 'other')
                          handleSettingChange('ibPort', v);
                      }}
                      className={`w-1/2 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                        portMode === 'other'
                          ? 'border-gray-300 focus:ring-blue-500'
                          : 'border-gray-200 bg-gray-100 text-gray-500'
                      }`}
                      disabled={portMode !== 'other'}
                      min={1}
                      max={65535}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    クライアントID
                  </label>
                  <input
                    type="number"
                    value={settings.ibClientId}
                    onChange={(e) =>
                      handleSettingChange('ibClientId', Number(e.target.value))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    アカウントID
                  </label>
                  <input
                    type="text"
                    value={settings.ibAccountId}
                    onChange={(e) =>
                      handleSettingChange('ibAccountId', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="例: U1234567"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.ibPaperTrading}
                    onChange={(e) =>
                      handleSettingChange('ibPaperTrading', e.target.checked)
                    }
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    ペーパートレーディングを使用
                  </span>
                </label>
              </div>
              <div className="mt-6">
                <button
                  onClick={testConnection}
                  className={`px-4 py-2 rounded-lg mr-4 text-white ${
                    testing ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  disabled={testing}
                >
                  {testing ? '接続中...' : '接続テスト'}
                </button>
                <span className="text-sm text-gray-500">
                  TWSまたはIB Gatewayが起動していることを確認してください
                </span>
              </div>

              {connectionResult && (
                <div
                  className={`mt-4 border rounded-lg p-4 ${
                    connectionResult.success
                      ? 'border-green-300 bg-green-50'
                      : 'border-red-300 bg-red-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      {connectionResult.success ? '接続成功' : '接続失敗'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {connectionResult.host}:{connectionResult.port}
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-gray-700">
                    {connectionResult.message}
                    {connectionResult.error && (
                      <>
                        <br />
                        エラー: {connectionResult.error}
                      </>
                    )}
                    {typeof connectionResult.latencyMs === 'number' && (
                      <>
                        <br />
                        レイテンシ: {connectionResult.latencyMs}ms
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 取引設定 */}
          {activeTab === 'trading' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">取引設定</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    最大日次損失 (¥)
                  </label>
                  <input
                    type="number"
                    value={settings.maxDailyLoss}
                    onChange={(e) =>
                      handleSettingChange(
                        'maxDailyLoss',
                        Number(e.target.value)
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    最大ポジションサイズ (¥)
                  </label>
                  <input
                    type="number"
                    value={settings.maxPositionSize}
                    onChange={(e) =>
                      handleSettingChange(
                        'maxPositionSize',
                        Number(e.target.value)
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ストップロス (%)
                  </label>
                  <input
                    type="number"
                    value={settings.stopLossPercent}
                    onChange={(e) =>
                      handleSettingChange(
                        'stopLossPercent',
                        Number(e.target.value)
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    利確 (%)
                  </label>
                  <input
                    type="number"
                    value={settings.takeProfitPercent}
                    onChange={(e) =>
                      handleSettingChange(
                        'takeProfitPercent',
                        Number(e.target.value)
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 通知設定 */}
          {activeTab === 'notifications' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">通知設定</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">メール通知</h3>
                    <p className="text-sm text-gray-500">
                      取引結果やアラートをメールで通知
                    </p>
                  </div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.emailNotifications}
                      onChange={(e) =>
                        handleSettingChange(
                          'emailNotifications',
                          e.target.checked
                        )
                      }
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">LINE通知</h3>
                    <p className="text-sm text-gray-500">
                      LINEメッセージでリアルタイム通知
                    </p>
                  </div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.lineNotifications}
                      onChange={(e) =>
                        handleSettingChange(
                          'lineNotifications',
                          e.target.checked
                        )
                      }
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">Slack通知</h3>
                    <p className="text-sm text-gray-500">
                      Slackチャンネルに通知を送信
                    </p>
                  </div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.slackNotifications}
                      onChange={(e) =>
                        handleSettingChange(
                          'slackNotifications',
                          e.target.checked
                        )
                      }
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* データ設定 */}
          {activeTab === 'data' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">データ設定</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    データ更新間隔 (ミリ秒)
                  </label>
                  <select
                    value={settings.dataRefreshInterval}
                    onChange={(e) =>
                      handleSettingChange(
                        'dataRefreshInterval',
                        Number(e.target.value)
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1000}>1秒</option>
                    <option value={5000}>5秒</option>
                    <option value={10000}>10秒</option>
                    <option value={30000}>30秒</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    データ保持期間 (日)
                  </label>
                  <input
                    type="number"
                    value={settings.maxDataRetentionDays}
                    onChange={(e) =>
                      handleSettingChange(
                        'maxDataRetentionDays',
                        Number(e.target.value)
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="365"
                  />
                </div>
              </div>
            </div>
          )}

          {/* セキュリティ設定 */}
          {activeTab === 'security' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">セキュリティ設定</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">二要素認証</h3>
                    <p className="text-sm text-gray-500">
                      ログイン時に二要素認証を要求
                    </p>
                  </div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.twoFactorAuth}
                      onChange={(e) =>
                        handleSettingChange('twoFactorAuth', e.target.checked)
                      }
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    セッションタイムアウト (分)
                  </label>
                  <input
                    type="number"
                    value={settings.sessionTimeout}
                    onChange={(e) =>
                      handleSettingChange(
                        'sessionTimeout',
                        Number(e.target.value)
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="5"
                    max="480"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 保存ボタン */}
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSaveSettings}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              設定を保存
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
