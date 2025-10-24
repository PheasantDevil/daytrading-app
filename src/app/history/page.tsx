'use client';

import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface PerformanceSummary {
  totalProfit: number;
  winRate: number;
  totalTrades: number;
  maxProfit: number;
  maxLoss: number;
  averageProfit: number;
}

interface TradeHistory {
  id: string;
  timestamp: string;
  symbol: string;
  name: string;
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  profit: number;
  strategy: string;
}

interface StrategyPerformance {
  name: string;
  trades: number;
  profit: number;
  winRate: number;
}

const profitData = [
  { date: '2024-01-01', profit: 0 },
  { date: '2024-01-02', profit: 5000 },
  { date: '2024-01-03', profit: 12000 },
  { date: '2024-01-04', profit: 8500 },
  { date: '2024-01-05', profit: 15000 },
  { date: '2024-01-06', profit: 22000 },
  { date: '2024-01-07', profit: 18000 },
  { date: '2024-01-08', profit: 25000 },
  { date: '2024-01-09', profit: 32000 },
  { date: '2024-01-10', profit: 28000 },
];

const strategyData = [
  { name: 'モメンタム', value: 45, profit: 15000 },
  { name: '平均回帰', value: 30, profit: 8000 },
  { name: 'ブレイクアウト', value: 25, profit: 5000 },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

export default function HistoryPage() {
  const [performance, setPerformance] = useState<PerformanceSummary>({
    totalProfit: 125000,
    winRate: 65,
    totalTrades: 42,
    maxProfit: 8500,
    maxLoss: -3200,
    averageProfit: 2976,
  });

  const [trades, setTrades] = useState<TradeHistory[]>([
    {
      id: '1',
      timestamp: '2024-01-10 14:32:15',
      symbol: '7203.T',
      name: 'トヨタ自動車',
      action: 'sell',
      quantity: 100,
      price: 2525,
      profit: 2500,
      strategy: 'モメンタム',
    },
    {
      id: '2',
      timestamp: '2024-01-10 13:45:22',
      symbol: '6758.T',
      name: 'ソニーグループ',
      action: 'buy',
      quantity: 50,
      price: 12400,
      profit: -1200,
      strategy: '平均回帰',
    },
    {
      id: '3',
      timestamp: '2024-01-10 11:20:33',
      symbol: '9984.T',
      name: 'ソフトバンクグループ',
      action: 'sell',
      quantity: 200,
      price: 1850,
      profit: 3200,
      strategy: 'ブレイクアウト',
    },
    {
      id: '4',
      timestamp: '2024-01-09 15:15:45',
      symbol: '7203.T',
      name: 'トヨタ自動車',
      action: 'buy',
      quantity: 100,
      price: 2500,
      profit: 0,
      strategy: 'モメンタム',
    },
    {
      id: '5',
      timestamp: '2024-01-09 10:30:12',
      symbol: '6758.T',
      name: 'ソニーグループ',
      action: 'sell',
      quantity: 50,
      price: 12376,
      profit: -1200,
      strategy: '平均回帰',
    },
  ]);

  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    symbol: '',
    strategy: '',
    profitMin: '',
    profitMax: '',
  });

  const [strategyPerformance, setStrategyPerformance] = useState<StrategyPerformance[]>([
    { name: 'モメンタム', trades: 18, profit: 15000, winRate: 72 },
    { name: '平均回帰', trades: 12, profit: 8000, winRate: 58 },
    { name: 'ブレイクアウト', trades: 12, profit: 5000, winRate: 67 },
  ]);

  const handleExportCSV = async () => {
    try {
      const response = await fetch('/api/trades/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trades-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export CSV:', error);
    }
  };

  const filteredTrades = trades.filter(trade => {
    if (filters.symbol && !trade.symbol.includes(filters.symbol)) return false;
    if (filters.strategy && trade.strategy !== filters.strategy) return false;
    if (filters.profitMin && trade.profit < Number(filters.profitMin)) return false;
    if (filters.profitMax && trade.profit > Number(filters.profitMax)) return false;
    return true;
  });

  return (
    <DashboardLayout>
      {/* パフォーマンスサマリー */}
      <div className="mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-4">パフォーマンスサマリー</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <p className="text-sm text-gray-500">総損益</p>
              <p className={`text-2xl font-bold ${performance.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {performance.totalProfit >= 0 ? '+' : ''}¥{performance.totalProfit.toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">勝率</p>
              <p className="text-2xl font-bold text-gray-900">{performance.winRate}%</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">取引数</p>
              <p className="text-2xl font-bold text-gray-900">{performance.totalTrades}回</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">平均利益</p>
              <p className={`text-2xl font-bold ${performance.averageProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {performance.averageProfit >= 0 ? '+' : ''}¥{performance.averageProfit.toLocaleString()}
              </p>
            </div>
          </div>

          {/* 損益グラフ */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => [`¥${value.toLocaleString()}`, '累積損益']}
                  labelFormatter={(label) => `日付: ${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  dot={{ fill: '#10B981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* フィルター */}
      <div className="mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">フィルター</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">日付（開始）</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">日付（終了）</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">銘柄</label>
              <input
                type="text"
                placeholder="例: 7203"
                value={filters.symbol}
                onChange={(e) => setFilters(prev => ({ ...prev, symbol: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">戦略</label>
              <select
                value={filters.strategy}
                onChange={(e) => setFilters(prev => ({ ...prev, strategy: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">すべて</option>
                <option value="モメンタム">モメンタム</option>
                <option value="平均回帰">平均回帰</option>
                <option value="ブレイクアウト">ブレイクアウト</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">最小利益</label>
              <input
                type="number"
                placeholder="例: 1000"
                value={filters.profitMin}
                onChange={(e) => setFilters(prev => ({ ...prev, profitMin: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">最大利益</label>
              <input
                type="number"
                placeholder="例: 10000"
                value={filters.profitMax}
                onChange={(e) => setFilters(prev => ({ ...prev, profitMax: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-between">
            <button
              onClick={() => setFilters({ dateFrom: '', dateTo: '', symbol: '', strategy: '', profitMin: '', profitMax: '' })}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              フィルターをリセット
            </button>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              CSVエクスポート
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 取引履歴テーブル */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">取引履歴</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日時</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">銘柄</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">売買</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">数量</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">価格</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">損益</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">戦略</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTrades.map((trade) => (
                    <tr key={trade.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {trade.timestamp}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{trade.symbol}</div>
                          <div className="text-sm text-gray-500">{trade.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          trade.action === 'buy' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {trade.action === 'buy' ? '購入' : '売却'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {trade.quantity}株
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ¥{trade.price.toLocaleString()}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        trade.profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {trade.profit >= 0 ? '+' : ''}¥{trade.profit.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {trade.strategy}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 統計情報 + 戦略別パフォーマンス */}
        <div className="space-y-6">
          {/* 統計情報 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">統計情報</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">最大利益</span>
                <span className="text-sm font-medium text-green-600">¥{performance.maxProfit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">最大損失</span>
                <span className="text-sm font-medium text-red-600">¥{performance.maxLoss.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">勝ちトレード</span>
                <span className="text-sm font-medium text-gray-900">{Math.round(performance.totalTrades * performance.winRate / 100)}回</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">負けトレード</span>
                <span className="text-sm font-medium text-gray-900">{performance.totalTrades - Math.round(performance.totalTrades * performance.winRate / 100)}回</span>
              </div>
            </div>
          </div>

          {/* 戦略別パフォーマンス */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">戦略別パフォーマンス</h3>
            <div className="h-48 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={strategyData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {strategyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {strategyPerformance.map((strategy, index) => (
                <div key={strategy.name} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <div>
                    <p className="text-sm font-medium">{strategy.name}</p>
                    <p className="text-xs text-gray-500">{strategy.trades}回取引</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${strategy.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ¥{strategy.profit.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">勝率{strategy.winRate}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
