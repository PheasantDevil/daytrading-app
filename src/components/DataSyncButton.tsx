'use client';

import { useState } from 'react';

interface DataSyncButtonProps {
  onSyncComplete?: () => void;
}

export default function DataSyncButton({
  onSyncComplete,
}: DataSyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);

    try {
      const response = await fetch('/api/stocks/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sync_all',
        }),
      });

      const result = await response.json();

      if (result.success) {
        setLastSync(new Date());
        onSyncComplete?.();
      } else {
        console.error('Sync failed:', result.error);
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">データ同期</h3>

      <div className="space-y-4">
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className={`w-full px-4 py-2 rounded-md font-medium transition-colors ${
            isSyncing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isSyncing ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              同期中...
            </div>
          ) : (
            '全銘柄データを同期'
          )}
        </button>

        {lastSync && (
          <div className="text-sm text-gray-600 text-center">
            最終同期: {lastSync.toLocaleString()}
          </div>
        )}

        <div className="text-xs text-gray-500">
          <p>• 全銘柄の株価データを最新に更新します</p>
          <p>• 処理には数分かかる場合があります</p>
          <p>• 同期中は他の操作を避けてください</p>
        </div>
      </div>
    </div>
  );
}
