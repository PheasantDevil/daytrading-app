import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

async function pingGateway(
  host: string,
  port: number
): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const { default: net } = await import('net');
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    const timeoutMs = 3000;
    const finalize = (ok: boolean, error?: string) => {
      try {
        socket.destroy();
      } catch {}
      resolve({ ok, latencyMs: Date.now() - start, error });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finalize(true));
    socket.once('timeout', () => finalize(false, 'timeout'));
    socket.once('error', (err) => finalize(false, err?.message || 'error'));
    socket.connect(port, host);
  });
}

export async function GET(_req: NextRequest) {
  try {
    const host = process.env.IB_HOST || '127.0.0.1';
    const port = Number(process.env.IB_PORT ?? 4002);
    const accountId = process.env.IB_ACCOUNT_ID || '';

    const ping = await pingGateway(host, port);
    if (!ping.ok) {
      return NextResponse.json(
        {
          success: false,
          message: 'IB Gateway not reachable',
          data: { host, port, accountId, error: ping.error },
        },
        { status: 503 }
      );
    }

    // TODO: 実IB API接続に置換予定。現状はモックの保有ポジションを返却
    const mockPositions = [
      {
        symbol: '7203.T',
        quantity: 100,
        avgPrice: 2500,
        marketPrice: 2525,
        pnl: 2500,
      },
      {
        symbol: '6758.T',
        quantity: 50,
        avgPrice: 17000,
        marketPrice: 16890,
        pnl: -5500,
      },
    ];

    return NextResponse.json({
      success: true,
      data: {
        accountId: accountId || 'UNKNOWN',
        positions: mockPositions,
        latencyMs: ping.latencyMs,
        host,
        port,
      },
    });
  } catch (error) {
    console.error('Positions API error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // 実際の実装では、Interactive Brokers APIからポジション情報を取得
    // 現在はモックデータを返す

    const mockPositions = [
      {
        symbol: '7203.T',
        name: 'トヨタ自動車',
        side: 'long',
        quantity: 100,
        entryPrice: 2500,
        currentPrice: 2525,
        unrealizedPnL: 2500,
        marginUsed: 252500,
        marketValue: 252500,
        averageCost: 2500,
        timestamp: new Date().toISOString(),
      },
      {
        symbol: '6758.T',
        name: 'ソニーグループ',
        side: 'long',
        quantity: 50,
        entryPrice: 12400,
        currentPrice: 12376,
        unrealizedPnL: -1200,
        marginUsed: 618800,
        marketValue: 618800,
        averageCost: 12400,
        timestamp: new Date().toISOString(),
      },
      {
        symbol: '9984.T',
        name: 'ソフトバンクグループ',
        side: 'short',
        quantity: 200,
        entryPrice: 1850,
        currentPrice: 1840,
        unrealizedPnL: 2000,
        marginUsed: 368000,
        marketValue: 368000,
        averageCost: 1850,
        timestamp: new Date().toISOString(),
      },
    ];

    return NextResponse.json({
      success: true,
      data: mockPositions,
    });
  } catch (error) {
    console.error('Failed to get positions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get positions' },
      { status: 500 }
    );
  }
}
