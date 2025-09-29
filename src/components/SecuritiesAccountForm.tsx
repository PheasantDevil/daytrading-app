'use client';

import { CreateSecuritiesAccountRequest } from '@/types/securities';
import { useState } from 'react';

interface SecuritiesAccountFormProps {
  onSubmit: (data: CreateSecuritiesAccountRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function SecuritiesAccountForm({
  onSubmit,
  onCancel,
  isLoading = false,
}: SecuritiesAccountFormProps) {
  const [formData, setFormData] = useState<CreateSecuritiesAccountRequest>({
    brokerName: 'kabuステーション',
    accountNumber: '',
    apiPassword: '',
    username: '',
    password: '',
  });

  const [showPasswords, setShowPasswords] = useState({
    password: false,
  });

  const [errors, setErrors] = useState<Partial<CreateSecuritiesAccountRequest>>(
    {}
  );

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // エラーをクリア
    if (errors[name as keyof CreateSecuritiesAccountRequest]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<CreateSecuritiesAccountRequest> = {};

    if (!formData.brokerName) newErrors.brokerName = '証券会社名は必須です';
    if (!formData.accountNumber) newErrors.accountNumber = '口座番号は必須です';
    if (!formData.apiPassword)
      newErrors.apiPassword = 'APIパスワードは必須です';
    if (!formData.username) newErrors.username = 'ユーザーIDは必須です';
    if (!formData.password) newErrors.password = 'パスワードは必須です';

    // 口座番号の形式チェック
    if (formData.accountNumber && !/^\d{8,12}$/.test(formData.accountNumber)) {
      newErrors.accountNumber = '口座番号は8-12桁の数字で入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('証券口座登録エラー:', error);
    }
  };

  const togglePasswordVisibility = (field: 'password') => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        証券口座情報登録
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 証券会社選択 */}
        <div>
          <label
            htmlFor="brokerName"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            証券会社名 *
          </label>
          <select
            id="brokerName"
            name="brokerName"
            value={formData.brokerName}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.brokerName ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isLoading}
          >
            <option value="SBI証券">SBI証券</option>
            <option value="楽天証券">楽天証券</option>
            <option value="マネックス証券">マネックス証券</option>
            <option value="松井証券">松井証券</option>
          </select>
          {errors.brokerName && (
            <p className="mt-1 text-sm text-red-600">{errors.brokerName}</p>
          )}
        </div>

        {/* 口座番号 */}
        <div>
          <label
            htmlFor="accountNumber"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            口座番号 *
          </label>
          <input
            type="text"
            id="accountNumber"
            name="accountNumber"
            value={formData.accountNumber}
            onChange={handleInputChange}
            placeholder="12345678"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.accountNumber ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isLoading}
          />
          {errors.accountNumber && (
            <p className="mt-1 text-sm text-red-600">{errors.accountNumber}</p>
          )}
        </div>

        {/* APIパスワード */}
        <div>
          <label
            htmlFor="apiPassword"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            APIパスワード *
          </label>
          <input
            type="password"
            id="apiPassword"
            name="apiPassword"
            value={formData.apiPassword}
            onChange={handleInputChange}
            placeholder="kabuステーションで設定したAPIパスワード（6-16桁の英数字）"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.apiPassword ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isLoading}
          />
          {errors.apiPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.apiPassword}</p>
          )}
        </div>

        {/* ユーザーID */}
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            ユーザーID (ログインID) *
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            placeholder="SBI証券のログインID"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.username ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isLoading}
          />
          {errors.username && (
            <p className="mt-1 text-sm text-red-600">{errors.username}</p>
          )}
        </div>

        {/* パスワード */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            パスワード *
          </label>
          <div className="relative">
            <input
              type={showPasswords.password ? 'text' : 'password'}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="SBI証券のログインパスワード"
              className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.password ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => togglePasswordVisibility('password')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              disabled={isLoading}
            >
              {showPasswords.password ? (
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password}</p>
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
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                セキュリティについて
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <ul className="list-disc pl-5 space-y-1">
                  <li>入力された認証情報は暗号化して安全に保存されます</li>
                  <li>APIキーはSBI証券の開発者ポータルで取得してください</li>
                  <li>デバイス認証の設定も併せて行ってください</li>
                  <li>取引パスワードは取引実行時に必要です</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* ボタン */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? '登録中...' : '登録'}
          </button>
        </div>
      </form>
    </div>
  );
}
