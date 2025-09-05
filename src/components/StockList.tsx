'use client';

import { Stock } from '@/types';
import { useEffect, useState } from 'react';

interface StockListProps {
  onStockSelect?: (stock: Stock) => void;
}

export default function StockList({ onStockSelect }: StockListProps) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchStocks();
  }, []);

  const fetchStocks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/stocks');
      const result = await response.json();

      if (result.success) {
        setStocks(result.data);
      } else {
        setError(result.error || 'Failed to fetch stocks');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const filteredStocks = stocks.filter(
    (stock) =>
      stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stock.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 text-center p-4">Error: {error}</div>;
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <input
          type="text"
          placeholder="銘柄を検索..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-2">
        {filteredStocks.map((stock) => (
          <div
            key={stock.id}
            className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() => onStockSelect?.(stock)}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">{stock.symbol}</h3>
                <p className="text-gray-600">{stock.name}</p>
                <p className="text-sm text-gray-500">{stock.market}</p>
              </div>
              {stock.sector && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {stock.sector}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredStocks.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          該当する銘柄が見つかりません
        </div>
      )}
    </div>
  );
}
