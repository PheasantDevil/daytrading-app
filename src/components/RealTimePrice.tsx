'use client';

import { useState, useEffect } from 'react';
import { StockApiResponse } from '@/lib/stock-api';

interface RealTimePriceProps {
  stockId: number;
  symbol: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export default function RealTimePrice({
  stockId,
  symbol,
  autoRefresh = true,
  refreshInterval = 5000,
}: RealTimePriceProps) {
  const [price, setPrice] = useState<StockApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPrice = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/stocks/${stockId}/realtime`);
      const result = await response.json();

      if (result.success) {
        setPrice(result.data);
        setLastUpdated(new Date());
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch price');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrice();

    if (autoRefresh) {
      const interval = setInterval(fetchPrice, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [stockId, autoRefresh, refreshInterval]);

  if (loading && !price) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 text-center p-4">
        Error: {error}
      </div>
    );
  }

  if (!price) {
    return (
      <div className="text-gray-500 text-center p-4">
        No price data available
      </div>
    );
  }

  const isPositive = price.change >= 0;
  const changeColor = isPositive ? 'text-green-600' : 'text-red-600';
  const bgColor = isPositive ? 'bg-green-50' : 'bg-red-50';

  return (
    <div className={`p-4 rounded-lg ${bgColor}`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold">{symbol}</h3>
        <span className="text-sm text-gray-500">
          {lastUpdated?.toLocaleTimeString()}
        </span>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold">{price.price.toFixed(2)}</span>
          <div className="text-right">
            <div className={`text-sm font-medium ${changeColor}`}>
              {isPositive ? '+' : ''}{price.change.toFixed(2)}
            </div>
            <div className={`text-xs ${changeColor}`}>
              {isPositive ? '+' : ''}{price.changePercent.toFixed(2)}%
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">High:</span>
            <span className="ml-2 font-medium">{price.high.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-600">Low:</span>
            <span className="ml-2 font-medium">{price.low.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-600">Open:</span>
            <span className="ml-2 font-medium">{price.open.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-600">Volume:</span>
            <span className="ml-2 font-medium">{price.volume.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
