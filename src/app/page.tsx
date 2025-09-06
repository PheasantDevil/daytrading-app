'use client';

import DataSyncButton from '@/components/DataSyncButton';
import PredictionDisplay from '@/components/PredictionDisplay';
import RealTimePrice from '@/components/RealTimePrice';
import StockChart from '@/components/StockChart';
import StockList from '@/components/StockList';
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
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            デイトレード用Webアプリ
          </h1>
          <nav className="flex space-x-4">
            <a
              href="/securities-accounts"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg
                className="-ml-1 mr-2 h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              証券口座管理
            </a>
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {/* 銘柄リスト */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">銘柄一覧</h2>
            <StockList onStockSelect={handleStockSelect} />
          </div>

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

          {/* チャート表示 */}
          <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2 xl:col-span-1">
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

          {/* データ同期 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <DataSyncButton onSyncComplete={() => window.location.reload()} />
          </div>
        </div>

        {/* 機能説明 */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-3xl mb-3">📈</div>
            <h3 className="text-lg font-semibold mb-2">株価取得</h3>
            <p className="text-gray-600 text-sm">
              リアルタイム株価データの取得と表示
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-3xl mb-3">🔮</div>
            <h3 className="text-lg font-semibold mb-2">株価予測</h3>
            <p className="text-gray-600 text-sm">機械学習による株価予測機能</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-3xl mb-3">🤖</div>
            <h3 className="text-lg font-semibold mb-2">自動売買</h3>
            <p className="text-gray-600 text-sm">
              システムによる自動的な株の売買
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-3xl mb-3">🛡️</div>
            <h3 className="text-lg font-semibold mb-2">リスク管理</h3>
            <p className="text-gray-600 text-sm">損切り・利確、資金管理機能</p>
          </div>
        </div>
      </div>
    </main>
  );
}
