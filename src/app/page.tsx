'use client';

import StockChart from '@/components/StockChart';
import StockList from '@/components/StockList';
import RealTimePrice from '@/components/RealTimePrice';
import DataSyncButton from '@/components/DataSyncButton';
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
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          デイトレード用Webアプリ
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
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

          {/* チャート表示 */}
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
