import {
  KabuAccountInfo,
  KabuApiCredentials,
  KabuApiResponse,
  KabuOrderRequest,
  KabuPosition,
} from '@/types/securities';

/**
 * kabuステーションAPIクライアント
 */
export class KabuApiClient {
  private baseUrl: string;
  private credentials: KabuApiCredentials;
  private token: string | null = null;

  constructor(credentials: KabuApiCredentials, baseUrl?: string) {
    this.baseUrl = baseUrl || 'http://localhost:18080/kabusapi';
    this.credentials = credentials;
  }

  /**
   * API認証（トークン取得）
   */
  private async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          APIPassword: this.credentials.apiPassword,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.token = data.Token;
        return true;
      }
      return false;
    } catch (error) {
      console.error('kabuステーションAPI認証エラー:', error);
      return false;
    }
  }

  /**
   * 認証済みリクエストを送信
   */
  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<KabuApiResponse<T>> {
    if (!this.token && !(await this.authenticate())) {
      return {
        IsOK: false,
        Code: 401,
        Message: '認証に失敗しました',
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'X-API-KEY': this.token!,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const data = await response.json();

      return {
        IsOK: data.IsOK || false,
        Code: data.Code || response.status,
        Message: data.Message || 'Unknown error',
        data: data,
      };
    } catch (error) {
      console.error('kabuステーションAPI リクエストエラー:', error);
      return {
        IsOK: false,
        Code: 500,
        Message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 口座情報取得
   */
  async getAccountInfo(): Promise<KabuApiResponse<KabuAccountInfo[]>> {
    return this.makeAuthenticatedRequest<KabuAccountInfo[]>('/wallet/cash');
  }

  /**
   * ポジション一覧取得
   */
  async getPositions(): Promise<KabuApiResponse<KabuPosition[]>> {
    return this.makeAuthenticatedRequest<KabuPosition[]>('/positions');
  }

  /**
   * 注文発注
   */
  async sendOrder(
    orderRequest: Omit<KabuOrderRequest, 'Password'>
  ): Promise<KabuApiResponse<any>> {
    const orderWithPassword = {
      ...orderRequest,
      Password: this.credentials.apiPassword,
    };

    return this.makeAuthenticatedRequest<any>('/sendorder', {
      method: 'POST',
      body: JSON.stringify(orderWithPassword),
    });
  }

  /**
   * 注文取消
   */
  async cancelOrder(orderId: string): Promise<KabuApiResponse<any>> {
    return this.makeAuthenticatedRequest<any>('/cancelorder', {
      method: 'PUT',
      body: JSON.stringify({
        OrderId: orderId,
        Password: this.credentials.apiPassword,
      }),
    });
  }

  /**
   * 約定履歴取得
   */
  async getExecutions(
    product?: string,
    startDay?: string,
    endDay?: string
  ): Promise<KabuApiResponse<any[]>> {
    const params = new URLSearchParams();
    if (product) params.append('product', product);
    if (startDay) params.append('startDay', startDay);
    if (endDay) params.append('endDay', endDay);

    return this.makeAuthenticatedRequest<any[]>(
      `/executions?${params.toString()}`
    );
  }

  /**
   * リアルタイム株価取得
   */
  async getBoard(
    symbol: string,
    exchange: number
  ): Promise<KabuApiResponse<any>> {
    return this.makeAuthenticatedRequest<any>(`/board/${symbol}@${exchange}`);
  }

  /**
   * 接続テスト
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.getAccountInfo();
      return response.IsOK;
    } catch (error) {
      console.error('kabuステーションAPI接続テストエラー:', error);
      return false;
    }
  }
}

/**
 * kabuステーションAPIクライアントのファクトリー関数
 */
export function createKabuApiClient(
  credentials: KabuApiCredentials,
  baseUrl?: string
): KabuApiClient {
  return new KabuApiClient(credentials, baseUrl);
}
