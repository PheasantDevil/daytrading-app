'use client';

import { PredictionResult } from '@/lib/ml/prediction-service';
import { useEffect, useState } from 'react';

interface PredictionDisplayProps {
  stockId: number;
  symbol: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export default function PredictionDisplay({
  stockId,
  symbol,
  autoRefresh = true,
  refreshInterval = 30000, // 30秒
}: PredictionDisplayProps) {
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/predictions/${stockId}`);
      const result = await response.json();

      if (result.success) {
        setPredictions(result.data);
        setLastUpdated(new Date());
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch predictions');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const trainModel = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/predictions/train', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stockId }),
      });

      const result = await response.json();

      if (result.success) {
        // 学習完了後に予測を取得
        setTimeout(fetchPredictions, 5000);
      } else {
        setError(result.error || 'Failed to train model');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();

    if (autoRefresh) {
      const interval = setInterval(fetchPredictions, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [stockId, autoRefresh, refreshInterval]);

  if (loading && predictions.length === 0) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 text-center p-4">Error: {error}</div>;
  }

  if (predictions.length === 0) {
    return (
      <div className="text-center p-4">
        <p className="text-gray-500 mb-4">予測データがありません</p>
        <button
          onClick={trainModel}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          モデルを学習
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{symbol} 予測</h3>
        <div className="flex space-x-2">
          <button
            onClick={fetchPredictions}
            disabled={loading}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            更新
          </button>
          <button
            onClick={trainModel}
            disabled={loading}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            再学習
          </button>
        </div>
      </div>

      {lastUpdated && (
        <p className="text-xs text-gray-500">
          最終更新: {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      <div className="space-y-3">
        {predictions.map((prediction, index) => (
          <div key={index} className="p-3 bg-gray-50 rounded-lg border">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-medium capitalize">
                {prediction.modelName.replace('_', ' ')}
              </h4>
              <span className="text-sm text-gray-500">
                {prediction.timestamp.toLocaleTimeString()}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">予測価格:</span>
                <span className="text-lg font-bold text-blue-600">
                  ¥{prediction.predictedPrice.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">信頼度:</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${prediction.confidence * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">
                    {(prediction.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {predictions.length > 1 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">平均予測</h4>
          <div className="flex justify-between items-center">
            <span className="text-sm text-blue-600">予測価格:</span>
            <span className="text-lg font-bold text-blue-800">
              ¥
              {(
                predictions.reduce((sum, p) => sum + p.predictedPrice, 0) /
                predictions.length
              ).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
