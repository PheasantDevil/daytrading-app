'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface PredictionData {
  stockId: number;
  symbol: string;
  currentPrice: number;
  predictedPrice: number;
  confidence: number;
  trend: 'up' | 'down' | 'neutral';
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  timestamp: string;
  modelWeights: Record<string, number>;
  accuracy: {
    mae: number;
    rmse: number;
  };
}

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
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<'idle' | 'training' | 'completed' | 'error'>('idle');

  const fetchPrediction = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/predictions/${stockId}`);
      const result = await response.json();

      if (result.success) {
        setPrediction(result.data);
        setLastUpdated(new Date());
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch prediction');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const trainModel = async () => {
    try {
      setTrainingStatus('training');
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
        setTrainingStatus('completed');
        // 学習完了後に予測を取得
        setTimeout(fetchPrediction, 2000);
      } else {
        setError(result.error || 'Failed to train model');
        setTrainingStatus('error');
      }
    } catch (err) {
      setError('Network error');
      setTrainingStatus('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrediction();

    if (autoRefresh) {
      const interval = setInterval(fetchPrediction, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [stockId, autoRefresh, refreshInterval]);

  if (loading && !prediction) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4">
        <div className="text-red-600 mb-4">Error: {error}</div>
        <button
          onClick={fetchPrediction}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          再試行
        </button>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="text-center p-4">
        <p className="text-gray-500 mb-4">予測データがありません</p>
        <button
          onClick={trainModel}
          disabled={trainingStatus === 'training'}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {trainingStatus === 'training' ? '学習中...' : 'モデルを学習'}
        </button>
      </div>
    );
  }

  // 予測チャート用のデータを生成
  const chartData = [
    { time: '現在', price: prediction.currentPrice, type: 'current' },
    { time: '予測', price: prediction.predictedPrice, type: 'predicted' },
  ];

  const priceChange = prediction.predictedPrice - prediction.currentPrice;
  const priceChangePercent = (priceChange / prediction.currentPrice) * 100;

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{symbol} 予測</h3>
        <div className="flex space-x-2">
          <button
            onClick={fetchPrediction}
            disabled={loading}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            更新
          </button>
          <button
            onClick={trainModel}
            disabled={loading || trainingStatus === 'training'}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {trainingStatus === 'training' ? '学習中...' : '再学習'}
          </button>
        </div>
      </div>

      {/* 最終更新時刻 */}
      {lastUpdated && (
        <p className="text-xs text-gray-500">
          最終更新: {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {/* 予測チャート */}
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis domain={['dataMin - 10', 'dataMax + 10']} />
            <Tooltip 
              formatter={(value: number) => [`¥${value.toFixed(2)}`, '価格']}
              labelFormatter={(label) => `時間: ${label}`}
            />
            <Area 
              type="monotone" 
              dataKey="price" 
              stroke="#3B82F6" 
              fill="#3B82F6" 
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 予測情報 */}
      <div className="space-y-3">
        {/* 現在価格と予測価格 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">現在価格</div>
            <div className="text-lg font-bold text-gray-900">
              ¥{prediction.currentPrice.toFixed(2)}
            </div>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-600 mb-1">予測価格</div>
            <div className="text-lg font-bold text-blue-900">
              ¥{prediction.predictedPrice.toFixed(2)}
            </div>
          </div>
        </div>

        {/* 価格変動 */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">予想変動</span>
            <div className="flex items-center space-x-2">
              <span className={`text-sm font-medium ${
                priceChange >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {priceChange >= 0 ? '+' : ''}¥{priceChange.toFixed(2)}
              </span>
              <span className={`text-sm font-medium ${
                priceChangePercent >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* 信頼度 */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">信頼度</span>
            <span className="text-sm font-medium">
              {(prediction.confidence * 100).toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                prediction.confidence >= 0.8 ? 'bg-green-500' :
                prediction.confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${prediction.confidence * 100}%` }}
            ></div>
          </div>
        </div>

        {/* 信頼区間 */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-2">信頼区間 (95%)</div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">
              ¥{prediction.confidenceInterval.lower.toFixed(2)}
            </span>
            <span className="text-sm text-gray-500">〜</span>
            <span className="text-sm text-gray-500">
              ¥{prediction.confidenceInterval.upper.toFixed(2)}
            </span>
          </div>
        </div>

        {/* トレンド */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">トレンド</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              prediction.trend === 'up' ? 'bg-green-100 text-green-800' :
              prediction.trend === 'down' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {prediction.trend === 'up' ? '上昇' : 
               prediction.trend === 'down' ? '下降' : '横ばい'}
            </span>
          </div>
        </div>

        {/* モデル重み */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-2">モデル重み</div>
          <div className="space-y-1">
            {Object.entries(prediction.modelWeights).map(([model, weight]) => (
              <div key={model} className="flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  {model.replace('lstm_', 'LSTM ')}
                </span>
                <span className="text-xs font-medium">
                  {(weight * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 精度指標 */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-2">精度指標</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center">
              <div className="text-xs text-gray-500">MAE</div>
              <div className="text-sm font-medium">{prediction.accuracy.mae.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">RMSE</div>
              <div className="text-sm font-medium">{prediction.accuracy.rmse.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
