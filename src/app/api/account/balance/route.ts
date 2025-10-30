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

    // TODO: 実IB API接続に置換予定。現状はモック残高を返却
    const mockBalance = {
      accountId: accountId || 'UNKNOWN',
      currency: 'JPY',
      cashBalance: 1_000_000,
      buyingPower: 2_500_000,
      equityWithLoan: 1_200_000,
      dayTradesRemaining: 3,
      timestamp: new Date().toISOString(),
      latencyMs: ping.latencyMs,
      host,
      port,
    };

    return NextResponse.json({ success: true, data: mockBalance });
  } catch (error) {
    console.error('Balance API error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // 実際の実装では、Interactive Brokers APIから口座残高を取得
    // 現在はモックデータを返す

    const mockBalance = {
      accountId: process.env.IB_ACCOUNT_ID || 'U1234567',
      balance: 1000000, // ¥1,000,000
      currency: 'JPY',
      marginAvailable: 950000,
      marginUsed: 50000,
      buyingPower: 1900000,
      netLiquidation: 1000000,
      totalCashValue: 950000,
      grossPositionValue: 50000,
      unrealizedPnL: 2500,
      realizedPnL: 12500,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: mockBalance,
    });
  } catch (error) {
    console.error('Failed to get account balance:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get account balance' },
      { status: 500 }
    );
  }
}
