'use client';

import SecuritiesAccountForm from '@/components/SecuritiesAccountForm';
import SecuritiesAccountList from '@/components/SecuritiesAccountList';
import { CreateSecuritiesAccountRequest } from '@/types/securities';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function SecuritiesAccountsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // ローカルストレージからトークンを取得
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }
    setToken(storedToken);
  }, [router]);

  const handleSubmit = async (data: CreateSecuritiesAccountRequest) => {
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch('/api/securities-accounts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        alert('証券口座が正常に登録されました');
        setShowForm(false);
        // ページをリロードして口座一覧を更新
        window.location.reload();
      } else {
        alert(`登録に失敗しました: ${result.message}`);
      }
    } catch (error) {
      console.error('証券口座登録エラー:', error);
      alert('登録中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">証券口座管理</h1>
              <p className="mt-2 text-gray-600">
                SBI証券などの証券会社の口座情報を管理し、API連携を行います
              </p>
            </div>

            <button
              onClick={() => setShowForm(true)}
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
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              新しい口座を登録
            </button>
          </div>
        </div>

        {/* 口座登録フォーム */}
        {showForm && (
          <div className="mb-8">
            <SecuritiesAccountForm
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isLoading={loading}
            />
          </div>
        )}

        {/* 口座一覧 */}
        <SecuritiesAccountList token={token} />

        {/* セキュリティ情報 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                SBI証券API連携について
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc pl-5 space-y-1">
                  <li>SBI証券の開発者ポータルでAPIキーを取得してください</li>
                  <li>デバイス認証の設定も併せて行ってください</li>
                  <li>認証情報は暗号化して安全に保存されます</li>
                  <li>接続テストでAPI連携を確認できます</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 取得手順 */}
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-gray-800 mb-3">
            SBI証券APIキー取得手順
          </h3>
          <div className="text-sm text-gray-600">
            <ol className="list-decimal pl-5 space-y-2">
              <li>SBI証券ウェブサイトにログイン</li>
              <li>「口座管理」→「お客さま情報 設定・変更」→「各種サービス」</li>
              <li>API利用申請・設定</li>
              <li>デバイス認証の設定</li>
              <li>APIキー・シークレットキーの取得</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
