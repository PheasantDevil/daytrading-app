import { NextRequest, NextResponse } from 'next/server';

// このAPIはNode.jsランタイムでのみ動作させる想定
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}) as any);
    const host = (body.host as string) || process.env.IB_HOST || '127.0.0.1';
    const port = Number(body.port ?? process.env.IB_PORT ?? 4002);
    const clientId = Number(body.clientId ?? process.env.IB_CLIENT_ID ?? 1);

    // netソケットで疎通のみ確認（IB API未使用・安全）
    const { default: net } = await import('net');

    const connectResult = await new Promise<{
      ok: boolean;
      latencyMs?: number;
      error?: string;
    }>((resolve) => {
      const startedAt = Date.now();
      const socket = new net.Socket();
      const timeoutMs = 5000;

      const finalize = (ok: boolean, error?: string) => {
        try {
          socket.destroy();
        } catch {}
        resolve({ ok, latencyMs: Date.now() - startedAt, error });
      };

      socket.setTimeout(timeoutMs);
      socket.once('connect', () => finalize(true));
      socket.once('timeout', () => finalize(false, 'timeout'));
      socket.once('error', (err) => finalize(false, err?.message || 'error'));
      socket.connect(port, host);
    });

    if (!connectResult.ok) {
      return NextResponse.json(
        {
          success: false,
          message: 'IB Gateway connection failed',
          data: {
            host,
            port,
            clientId,
            latencyMs: connectResult.latencyMs,
            error: connectResult.error,
            suggestions: [
              'IB Gateway/TWSを起動してください',
              `IB Gatewayのポート設定が${port}であることを確認してください（一般的には 4002/7497/7496）`,
              'Paper/Liveモードと環境変数の整合性を確認してください',
            ],
          },
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'IB Gateway connection successful',
      data: {
        host,
        port,
        clientId,
        latencyMs: connectResult.latencyMs,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Connection test failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Connection test failed',
        message:
          'Unable to connect to Interactive Brokers. Please check your TWS/Gateway settings.',
      },
      { status: 500 }
    );
  }
}
