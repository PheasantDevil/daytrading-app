'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface MarketData {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: string;
  high24h: number;
  low24h: number;
  change24h: number;
  changePercent24h: number;
}

interface UseRealtimePriceOptions {
  symbol: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onError?: (error: Error) => void;
}

interface UseRealtimePriceReturn {
  data: MarketData | null;
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  reconnect: () => void;
}

/**
 * リアルタイム価格データを取得するカスタムフック
 * HTTPポーリングを使用してサーバーからリアルタイムデータを取得
 */
export function useRealtimePrice({
  symbol,
  autoRefresh = true,
  refreshInterval = 5000,
  onError,
}: UseRealtimePriceOptions): UseRealtimePriceReturn {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 市場データを取得
  const fetchMarketData = useCallback(async () => {
    try {
      // 前のリクエストをキャンセル
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // 新しいAbortControllerを作成
      abortControllerRef.current = new AbortController();

      const response = await fetch(`/api/stream?symbol=${encodeURIComponent(symbol)}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setError(null);
        setIsConnected(true);
        setLoading(false);
      } else {
        throw new Error(result.error || 'Failed to fetch market data');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // リクエストがキャンセルされた場合は無視
        return;
      }

      console.error('Failed to fetch market data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch market data');
      setIsConnected(false);
      setLoading(false);
      onError?.(err instanceof Error ? err : new Error('Failed to fetch market data'));
    }
  }, [symbol, onError]);

  // 手動再接続
  const reconnect = useCallback(() => {
    setError(null);
    setLoading(true);
    fetchMarketData();
  }, [fetchMarketData]);

  // 自動更新の開始/停止
  useEffect(() => {
    if (autoRefresh && symbol) {
      // 初回データ取得
      fetchMarketData();

      // 定期的なデータ取得
      intervalRef.current = setInterval(fetchMarketData, refreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }
  }, [autoRefresh, symbol, refreshInterval, fetchMarketData]);

  // シンボルが変更された場合の処理
  useEffect(() => {
    if (symbol) {
      setLoading(true);
      setError(null);
      fetchMarketData();
    }
  }, [symbol, fetchMarketData]);

  return {
    data,
    loading,
    error,
    isConnected,
    reconnect,
  };
}

/**
 * 複数銘柄のリアルタイム価格データを取得するカスタムフック
 */
export function useRealtimePrices({
  symbols,
  autoRefresh = true,
  refreshInterval = 5000,
  onError,
}: {
  symbols: string[];
  autoRefresh?: boolean;
  refreshInterval?: number;
  onError?: (error: Error) => void;
}): {
  data: Map<string, MarketData>;
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  reconnect: () => void;
} {
  const [data, setData] = useState<Map<string, MarketData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchMarketData = useCallback(async () => {
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'subscribe',
          symbols: symbols,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        const newData = new Map<string, MarketData>();
        result.data.forEach((marketData: MarketData) => {
          newData.set(marketData.symbol, marketData);
        });
        
        setData(newData);
        setError(null);
        setIsConnected(true);
        setLoading(false);
      } else {
        throw new Error(result.error || 'Failed to fetch market data');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      console.error('Failed to fetch market data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch market data');
      setIsConnected(false);
      setLoading(false);
      onError?.(err instanceof Error ? err : new Error('Failed to fetch market data'));
    }
  }, [symbols, onError]);

  const reconnect = useCallback(() => {
    setError(null);
    setLoading(true);
    fetchMarketData();
  }, [fetchMarketData]);

  useEffect(() => {
    if (autoRefresh && symbols.length > 0) {
      fetchMarketData();
      intervalRef.current = setInterval(fetchMarketData, refreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }
  }, [autoRefresh, symbols, refreshInterval, fetchMarketData]);

  useEffect(() => {
    if (symbols.length > 0) {
      setLoading(true);
      setError(null);
      fetchMarketData();
    }
  }, [symbols, fetchMarketData]);

  return {
    data,
    loading,
    error,
    isConnected,
    reconnect,
  };
}
