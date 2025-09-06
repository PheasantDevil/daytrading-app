import {
  SbiAccountInfo,
  SbiApiCredentials,
  SbiApiResponse,
  SbiOrderRequest,
  SbiOrderResponse,
  SbiPosition,
} from '@/types/securities';

const SBI_API_BASE_URL =
  process.env.SBI_API_BASE_URL || 'https://api.sbisec.co.jp';
const SBI_API_TIMEOUT = parseInt(process.env.SBI_API_TIMEOUT || '30000');

/**
 * SBI証券APIクライアント
 */
export class SbiApiClient {
  private credentials: SbiApiCredentials;
  private accessToken: string | null = null;

  constructor(credentials: SbiApiCredentials) {
    this.credentials = credentials;
  }

  /**
   * API認証
   */
  private async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${SBI_API_BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: this.credentials.apiKey,
          client_secret: this.credentials.apiSecret,
          username: this.credentials.username,
          password: this.credentials.password,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.access_token;
        return true;
      }
      return false;
    } catch (error) {
      console.error('SBI証券API認証エラー:', error);
      return false;
    }
  }

  /**
   * 認証済みリクエストを送信
   */
  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<SbiApiResponse<T>> {
    if (!this.accessToken && !(await this.authenticate())) {
      return {
        success: false,
        error: '認証に失敗しました',
        timestamp: new Date(),
      };
    }

    try {
      const response = await fetch(`${SBI_API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: AbortSignal.timeout(SBI_API_TIMEOUT),
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          data,
          timestamp: new Date(),
        };
      } else {
        return {
          success: false,
          error: data.message || `HTTP ${response.status}`,
          timestamp: new Date(),
        };
      }
    } catch (error) {
      console.error('SBI証券API リクエストエラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  /**
   * 口座情報取得
   */
  async getAccountInfo(): Promise<SbiApiResponse<SbiAccountInfo>> {
    return this.makeAuthenticatedRequest<SbiAccountInfo>('/api/account/info');
  }

  /**
   * ポジション一覧取得
   */
  async getPositions(): Promise<SbiApiResponse<SbiPosition[]>> {
    return this.makeAuthenticatedRequest<SbiPosition[]>('/api/positions');
  }

  /**
   * 注文発注
   */
  async placeOrder(
    orderRequest: SbiOrderRequest
  ): Promise<SbiApiResponse<SbiOrderResponse>> {
    return this.makeAuthenticatedRequest<SbiOrderResponse>('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...orderRequest,
        accountNumber: this.credentials.accountNumber,
        tradingPassword: this.credentials.tradingPassword,
      }),
    });
  }

  /**
   * 注文取消
   */
  async cancelOrder(
    orderId: string
  ): Promise<SbiApiResponse<{ success: boolean }>> {
    return this.makeAuthenticatedRequest<{ success: boolean }>(
      `/api/orders/${orderId}`,
      {
        method: 'DELETE',
      }
    );
  }

  /**
   * 約定履歴取得
   */
  async getExecutionHistory(
    startDate?: string,
    endDate?: string
  ): Promise<SbiApiResponse<any[]>> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return this.makeAuthenticatedRequest<any[]>(
      `/api/executions?${params.toString()}`
    );
  }

  /**
   * リアルタイム株価取得
   */
  async getRealTimePrice(symbol: string): Promise<SbiApiResponse<any>> {
    return this.makeAuthenticatedRequest<any>(`/api/market/realtime/${symbol}`);
  }

  /**
   * 接続テスト
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.getAccountInfo();
      return response.success;
    } catch (error) {
      console.error('SBI証券API接続テストエラー:', error);
      return false;
    }
  }
}

/**
 * SBI証券APIクライアントのファクトリー関数
 */
export function createSbiApiClient(
  credentials: SbiApiCredentials
): SbiApiClient {
  return new SbiApiClient(credentials);
}
