'use client';

import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useState, useEffect } from 'react';

interface TradingStatus {
  isRunning: boolean;
  isPaused: boolean;
  todayTrades: number;
  todayProfit: number;
}

interface Strategy {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
}

interface RiskSettings {
  maxDailyLoss: number;
  positionSizePercent: number;
  stopLossPercent: number;
  takeProfitPercent: number;
}

interface Position {
  symbol: string;
  name: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  profit: number;
}

interface TradeLog {
  timestamp: string;
  symbol: string;
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  profit?: number;
}

export default function AutoTradingPage() {
  const [status, setStatus] = useState<TradingStatus>({
    isRunning: false,
    isPaused: false,
    todayTrades: 3,
    todayProfit: 12500,
  });

  const [strategies, setStrategies] = useState<Strategy[]>([
    {
      id: 'momentum',
      name: 'モメンタム',
      enabled: true,
      description: '価格の勢いを利用した戦略',
    },
    {
      id: 'mean-reversion',
      name: '平均回帰',
      enabled: false,
      description: '価格の平均回帰を利用した戦略',
    },
    {
      id: 'breakout',
      name: 'ブレイクアウト',
      enabled: true,
      description: '価格の突破を利用した戦略',
    },
  ]);

  const [riskSettings, setRiskSettings] = useState<RiskSettings>({
    maxDailyLoss: 50000,
    positionSizePercent: 10,
    stopLossPercent: 3,
    takeProfitPercent: 5,
  });

  const [positions, setPositions] = useState<Position[]>([
    {
      symbol: '7203.T',
      name: 'トヨタ自動車',
      quantity: 100,
      entryPrice: 2500,
      currentPrice: 2525,
      profit: 2500,
    },
    {
      symbol: '6758.T',
      name: 'ソニーグループ',
      quantity: 50,
      entryPrice: 12400,
      currentPrice: 12376,
      profit: -1200,
    },
  ]);

  const [tradeLogs, setTradeLogs] = useState<TradeLog[]>([
    {
      timestamp: '12:34:56',
      symbol: '7203.T',
      action: 'buy',
      quantity: 100,
      price: 2500,
    },
    {
      timestamp: '12:45:23',
      symbol: '6758.T',
      action: 'sell',
      quantity: 50,
      price: 12376,
      profit: -1200,
    },
    {
      timestamp: '13:12:45',
      symbol: '7203.T',
      action: 'sell',
      quantity: 100,
      price: 2525,
      profit: 2500,
    },
  ]);

  const handleStartTrading = async () => {
    try {
      const response = await fetch('/api/auto-trading/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        setStatus((prev) => ({ ...prev, isRunning: true, isPaused: false }));
      }
    } catch (error) {
      console.error('Failed to start trading:', error);
    }
  };

  const handleStopTrading = async () => {
    try {
      const response = await fetch('/api/auto-trading/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        setStatus((prev) => ({ ...prev, isRunning: false, isPaused: false }));
      }
    } catch (error) {
      console.error('Failed to stop trading:', error);
    }
  };

  const handlePauseTrading = () => {
    setStatus((prev) => ({ ...prev, isPaused: !prev.isPaused }));
  };

  const handleStrategyToggle = (strategyId: string) => {
    setStrategies((prev) =>
      prev.map((strategy) =>
        strategy.id === strategyId
          ? { ...strategy, enabled: !strategy.enabled }
          : strategy
      )
    );
  };

  const handleRiskSettingChange = (key: keyof RiskSettings, value: number) => {
    setRiskSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <DashboardLayout>
      {/* 自動売買ステータス */}
      <div className="mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">自動売買ステータス</h2>
            <div className="flex items-center space-x-4">
              <div
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  status.isRunning && !status.isPaused
                    ? 'bg-green-100 text-green-800'
                    : status.isPaused
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                }`}
              >
                {status.isRunning && !status.isPaused
                  ? '● 実行中'
                  : status.isPaused
                    ? '● 一時停止'
                    : '● 停止中'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">今日の取引</p>
              <p className="text-2xl font-bold text-gray-900">
                {status.todayTrades}回
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">今日の利益</p>
              <p
                className={`text-2xl font-bold ${status.todayProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {status.todayProfit >= 0 ? '+' : ''}¥
                {status.todayProfit.toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">アクティブポジション</p>
              <p className="text-2xl font-bold text-gray-900">
                {positions.length}件
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-center space-x-4">
            {!status.isRunning ? (
              <button
                onClick={handleStartTrading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                自動売買開始
              </button>
            ) : (
              <>
                <button
                  onClick={handlePauseTrading}
                  className={`px-6 py-2 rounded-lg font-medium ${
                    status.isPaused
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-yellow-600 text-white hover:bg-yellow-700'
                  }`}
                >
                  {status.isPaused ? '再開' : '一時停止'}
                </button>
                <button
                  onClick={handleStopTrading}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  停止
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 戦略設定 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">戦略設定</h3>
          <div className="space-y-4">
            {strategies.map((strategy) => (
              <div
                key={strategy.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={strategy.enabled}
                    onChange={() => handleStrategyToggle(strategy.id)}
                    className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div>
                    <p className="font-medium">{strategy.name}</p>
                    <p className="text-sm text-gray-500">
                      {strategy.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* リスク管理 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">リスク管理</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                最大損失 (¥/日)
              </label>
              <input
                type="number"
                value={riskSettings.maxDailyLoss}
                onChange={(e) =>
                  handleRiskSettingChange(
                    'maxDailyLoss',
                    Number(e.target.value)
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ポジションサイズ (%)
              </label>
              <input
                type="number"
                value={riskSettings.positionSizePercent}
                onChange={(e) =>
                  handleRiskSettingChange(
                    'positionSizePercent',
                    Number(e.target.value)
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ストップロス (%)
              </label>
              <input
                type="number"
                value={riskSettings.stopLossPercent}
                onChange={(e) =>
                  handleRiskSettingChange(
                    'stopLossPercent',
                    Number(e.target.value)
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                利確 (%)
              </label>
              <input
                type="number"
                value={riskSettings.takeProfitPercent}
                onChange={(e) =>
                  handleRiskSettingChange(
                    'takeProfitPercent',
                    Number(e.target.value)
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* アクティブポジション */}
      <div className="mt-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">アクティブポジション</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    銘柄
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    数量
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    取得価格
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    現在価格
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    損益
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {positions.map((position, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {position.symbol}
                        </div>
                        <div className="text-sm text-gray-500">
                          {position.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {position.quantity}株
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ¥{position.entryPrice.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ¥{position.currentPrice.toLocaleString()}
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        position.profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {position.profit >= 0 ? '+' : ''}¥
                      {position.profit.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 取引ログ */}
      <div className="mt-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">
            取引ログ（リアルタイム）
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tradeLogs.map((log, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-3 bg-gray-50 rounded"
              >
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-500">{log.timestamp}</span>
                  <span className="font-medium">{log.symbol}</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      log.action === 'buy'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {log.action === 'buy' ? '購入' : '売却'}
                  </span>
                  <span className="text-sm">
                    {log.quantity}株 @¥{log.price.toLocaleString()}
                  </span>
                </div>
                {log.profit !== undefined && (
                  <span
                    className={`text-sm font-medium ${
                      log.profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {log.profit >= 0 ? '+' : ''}¥{log.profit.toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
