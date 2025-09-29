'use client';

import { useEffect, useState } from 'react';

interface DemoOrder {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  createdAt: Date;
  filledAt?: Date;
}

interface DemoPosition {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

interface DemoTradingPanelProps {
  selectedSymbol?: string;
  currentPrice?: number;
}

export default function DemoTradingPanel({
  selectedSymbol,
  currentPrice = 0,
}: DemoTradingPanelProps) {
  const [balance, setBalance] = useState<number>(0);
  const [positions, setPositions] = useState<DemoPosition[]>([]);
  const [orders, setOrders] = useState<DemoOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [orderForm, setOrderForm] = useState({
    side: 'BUY' as 'BUY' | 'SELL',
    quantity: 100,
    price: currentPrice,
  });

  useEffect(() => {
    fetchBalance();
    fetchPositions();
    fetchOrders();
  }, []);

  useEffect(() => {
    if (currentPrice > 0) {
      setOrderForm((prev) => ({ ...prev, price: currentPrice }));
    }
  }, [currentPrice]);

  const fetchBalance = async () => {
    try {
      const response = await fetch('/api/trading/demo/balance');
      const result = await response.json();
      if (result.success) {
        setBalance(result.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  const fetchPositions = async () => {
    try {
      const response = await fetch('/api/trading/demo/orders');
      const result = await response.json();
      if (result.success) {
        setPositions(result.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch positions:', error);
    }
  };

  const fetchOrders = async () => {
    // 注文履歴の取得ロジックを実装
    // 現在は簡易実装
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSymbol) {
      alert('銘柄を選択してください');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/trading/demo/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: selectedSymbol,
          side: orderForm.side,
          quantity: orderForm.quantity,
          price: orderForm.price,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`注文が発注されました (${result.source}モード)`);
        fetchBalance();
        fetchPositions();
        fetchOrders();
      } else {
        alert(`注文エラー: ${result.message}`);
      }
    } catch (error) {
      console.error('Order placement error:', error);
      alert('注文の発注に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">デモトレード</h2>

      {/* 口座情報 */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-medium mb-2">口座情報</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-600">現金残高</span>
            <p className="text-lg font-semibold">{formatCurrency(balance)}</p>
          </div>
          <div>
            <span className="text-sm text-gray-600">総資産</span>
            <p className="text-lg font-semibold">
              {formatCurrency(
                balance +
                  positions.reduce(
                    (sum, pos) => sum + pos.quantity * pos.currentPrice,
                    0
                  )
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 注文フォーム */}
      {selectedSymbol && (
        <form onSubmit={handleOrderSubmit} className="mb-6">
          <h3 className="text-lg font-medium mb-4">注文発注</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                銘柄
              </label>
              <input
                type="text"
                value={selectedSymbol}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                売買
              </label>
              <select
                value={orderForm.side}
                onChange={(e) =>
                  setOrderForm((prev) => ({
                    ...prev,
                    side: e.target.value as 'BUY' | 'SELL',
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="BUY">買い</option>
                <option value="SELL">売り</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                数量
              </label>
              <input
                type="number"
                value={orderForm.quantity}
                onChange={(e) =>
                  setOrderForm((prev) => ({
                    ...prev,
                    quantity: parseInt(e.target.value) || 0,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                価格
              </label>
              <input
                type="number"
                value={orderForm.price}
                onChange={(e) =>
                  setOrderForm((prev) => ({
                    ...prev,
                    price: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                step="0.01"
                min="0"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? '発注中...' : '注文発注'}
          </button>
        </form>
      )}

      {/* ポジション一覧 */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-4">保有ポジション</h3>
        {positions.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            保有ポジションはありません
          </p>
        ) : (
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
                    平均価格
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    現在価格
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    評価損益
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {positions.map((position, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {position.symbol}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {position.quantity.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(position.averagePrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(position.currentPrice)}
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        position.unrealizedPnl >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(position.unrealizedPnl)}
                      <br />
                      <span className="text-xs">
                        {formatPercent(position.unrealizedPnlPercent)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 注意事項 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-yellow-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.726-1.36 3.491 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              デモトレードについて
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                これはデモ環境です。実際の取引は行われません。
                仮想資金（100万円）で取引戦略をテストできます。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
