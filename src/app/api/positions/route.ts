import { NextResponse } from 'next/server';
import { prisma } from '@/core/database';

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
