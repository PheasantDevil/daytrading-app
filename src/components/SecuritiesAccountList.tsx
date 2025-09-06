'use client';

import { SecuritiesAccount } from '@/types/securities';
import { useEffect, useState } from 'react';

interface SecuritiesAccountListProps {
  token: string;
}

export default function SecuritiesAccountList({
  token,
}: SecuritiesAccountListProps) {
  const [accounts, setAccounts] = useState<SecuritiesAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState<number | null>(
    null
  );

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/securities-accounts', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        setAccounts(data.data);
      } else {
        setError(data.message || '口座一覧の取得に失敗しました');
      }
    } catch (error) {
      console.error('口座一覧取得エラー:', error);
      setError('サーバーエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (accountId: number) => {
    try {
      setTestingConnection(accountId);
      const response = await fetch(
        `/api/securities-accounts/${accountId}/test-connection`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        // 接続テスト成功時は口座一覧を再取得
        await fetchAccounts();
        alert('接続テストが成功しました');
      } else {
        alert(`接続テストが失敗しました: ${data.message}`);
      }
    } catch (error) {
      console.error('接続テストエラー:', error);
      alert('接続テスト中にエラーが発生しました');
    } finally {
      setTestingConnection(null);
    }
  };

  const deleteAccount = async (accountId: number) => {
    if (!confirm('この口座を削除しますか？この操作は取り消せません。')) {
      return;
    }

    try {
      const response = await fetch(`/api/securities-accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        await fetchAccounts();
        alert('口座が削除されました');
      } else {
        alert(`削除に失敗しました: ${data.message}`);
      }
    } catch (error) {
      console.error('口座削除エラー:', error);
      alert('削除中にエラーが発生しました');
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">口座一覧を読み込み中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">エラー</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
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
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            証券口座が登録されていません
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            新しい証券口座を登録してください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">登録済み証券口座</h2>
      </div>

      <div className="divide-y divide-gray-200">
        {accounts.map((account) => (
          <div key={account.id} className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div
                      className={`h-3 w-3 rounded-full ${
                        account.isActive ? 'bg-green-400' : 'bg-red-400'
                      }`}
                    ></div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      {account.brokerName}
                    </h3>
                    <p className="text-sm text-gray-500">
                      口座番号: {account.accountNumber}
                    </p>
                    <p className="text-sm text-gray-500">
                      ユーザーID: {account.username}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="text-right">
                  <div className="text-sm text-gray-500">
                    {account.deviceRegistered ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        デバイス登録済み
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        デバイス未登録
                      </span>
                    )}
                  </div>
                  {account.lastConnected && (
                    <div className="text-xs text-gray-400">
                      最終接続:{' '}
                      {new Date(account.lastConnected).toLocaleString('ja-JP')}
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => testConnection(account.id)}
                    disabled={testingConnection === account.id}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {testingConnection === account.id ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-3 w-3 text-gray-500"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        テスト中...
                      </>
                    ) : (
                      '接続テスト'
                    )}
                  </button>

                  <button
                    onClick={() => deleteAccount(account.id)}
                    className="inline-flex items-center px-3 py-1.5 border border-red-300 shadow-sm text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
