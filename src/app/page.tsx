'use client';

import DataSyncButton from '@/components/DataSyncButton';
import DemoTradingPanel from '@/components/DemoTradingPanel';
import PredictionDisplay from '@/components/PredictionDisplay';
import RealTimePrice from '@/components/RealTimePrice';
import StockChart from '@/components/StockChart';
import StockList from '@/components/StockList';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ChartData, Stock } from '@/types';
import { useState } from 'react';

export default function Home() {
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [stockPrices, setStockPrices] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(false);

  const handleStockSelect = async (stock: Stock) => {
    setSelectedStock(stock);
    setLoading(true);

    try {
      const response = await fetch(`/api/stocks/${stock.id}/prices?limit=50`);
      const result = await response.json();

      if (result.success) {
        const chartData: ChartData[] = result.data.map((price: any) => ({
          timestamp: new Date(price.timestamp),
          price: parseFloat(price.price.toString()),
          volume: price.volume ? parseInt(price.volume.toString()) : undefined,
        }));
        setStockPrices(chartData);
      }
    } catch (error) {
      console.error('Failed to fetch stock prices:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      {/* マーケットサマリー */}
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-sm font-bold">N</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">日経平均</p>
                <p className="text-lg font-semibold text-gray-900">38,500</p>
                <p className="text-sm text-green-600">+250 (+0.65%)</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-sm font-bold">T</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">TOPIX</p>
                <p className="text-lg font-semibold text-gray-900">2,750</p>
                <p className="text-sm text-red-600">-15 (-0.54%)</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 text-sm font-bold">D</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">ダウ平均</p>
                <p className="text-lg font-semibold text-gray-900">34,200</p>
                <p className="text-sm text-green-600">+180 (+0.53%)</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <span className="text-yellow-600 text-sm font-bold">$</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">USD/JPY</p>
                <p className="text-lg font-semibold text-gray-900">149.85</p>
                <p className="text-sm text-red-600">-0.15 (-0.10%)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左カラム: ウォッチリスト */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">ウォッチリスト</h2>
            <StockList onStockSelect={handleStockSelect} />
          </div>
        </div>

        {/* 中央: チャート + テクニカル指標 */}
        <div className="lg:col-span-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">
              {selectedStock
                ? `${selectedStock.symbol} - ${selectedStock.name}`
                : '株価チャート'}
            </h2>

            {selectedStock ? (
              <div>
                {loading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : stockPrices.length > 0 ? (
                  <StockChart
                    data={stockPrices}
                    symbol={selectedStock.symbol}
                  />
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    価格データがありません
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                銘柄を選択してください
              </div>
            )}
          </div>
        </div>

        {/* 右カラム: 予測情報 + ニュース */}
        <div className="lg:col-span-3">
          <div className="space-y-6">
            {/* リアルタイム価格 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">リアルタイム価格</h2>
              {selectedStock ? (
                <RealTimePrice
                  stockId={selectedStock.id}
                  symbol={selectedStock.symbol}
                  autoRefresh={true}
                  refreshInterval={5000}
                />
              ) : (
                <div className="text-center text-gray-500 py-8">
                  銘柄を選択してください
                </div>
              )}
            </div>

            {/* 株価予測 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">株価予測</h2>
              {selectedStock ? (
                <PredictionDisplay
                  stockId={selectedStock.id}
                  symbol={selectedStock.symbol}
                  autoRefresh={true}
                  refreshInterval={30000}
                />
              ) : (
                <div className="text-center text-gray-500 py-8">
                  銘柄を選択してください
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 下部: ポジション一覧 + 最近の取引 */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ポジション一覧 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">現在のポジション</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <div>
                <p className="font-medium">7203.T</p>
                <p className="text-sm text-gray-500">トヨタ自動車</p>
              </div>
              <div className="text-right">
                <p className="font-medium">100株</p>
                <p className="text-sm text-green-600">+¥2,500</p>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <div>
                <p className="font-medium">6758.T</p>
                <p className="text-sm text-gray-500">ソニーグループ</p>
              </div>
              <div className="text-right">
                <p className="font-medium">50株</p>
                <p className="text-sm text-red-600">-¥1,200</p>
              </div>
            </div>
          </div>
        </div>

        {/* 最近の取引 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">最近の取引</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <div>
                <p className="font-medium">7203.T 売却</p>
                <p className="text-sm text-gray-500">14:32:15</p>
              </div>
              <div className="text-right">
                <p className="font-medium">100株 @¥2,525</p>
                <p className="text-sm text-green-600">+¥2,500</p>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <div>
                <p className="font-medium">6758.T 購入</p>
                <p className="text-sm text-gray-500">13:45:22</p>
              </div>
              <div className="text-right">
                <p className="font-medium">50株 @¥12,400</p>
                <p className="text-sm text-gray-500">-¥620,000</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* クイックアクション */}
      <div className="mt-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">クイックアクション</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button className="flex items-center justify-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50">
              <div className="text-2xl mr-3">📊</div>
              <div className="text-left">
                <p className="font-medium">データ同期</p>
                <p className="text-sm text-gray-500">最新データを取得</p>
              </div>
            </button>
            <button className="flex items-center justify-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50">
              <div className="text-2xl mr-3">🤖</div>
              <div className="text-left">
                <p className="font-medium">自動売買</p>
                <p className="text-sm text-gray-500">設定・管理</p>
              </div>
            </button>
            <button className="flex items-center justify-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50">
              <div className="text-2xl mr-3">📈</div>
              <div className="text-left">
                <p className="font-medium">取引履歴</p>
                <p className="text-sm text-gray-500">過去の取引を確認</p>
              </div>
            </button>
            <button className="flex items-center justify-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50">
              <div className="text-2xl mr-3">⚙️</div>
              <div className="text-left">
                <p className="font-medium">設定</p>
                <p className="text-sm text-gray-500">システム設定</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
