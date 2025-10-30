import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const symbol = searchParams.get('symbol');
    const strategy = searchParams.get('strategy');
    const profitMin = searchParams.get('profitMin');
    const profitMax = searchParams.get('profitMax');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // フィルター条件を構築
    const where: any = {};

    if (symbol) {
      where.stock = {
        symbol: {
          contains: symbol,
        },
      };
    }

    if (strategy) {
      where.strategy = strategy;
    }

    if (profitMin || profitMax) {
      where.profit = {};
      if (profitMin) where.profit.gte = parseFloat(profitMin);
      if (profitMax) where.profit.lte = parseFloat(profitMax);
    }

    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) where.timestamp.gte = new Date(dateFrom);
      if (dateTo) where.timestamp.lte = new Date(dateTo);
    }

    const trades = await prisma.trade.findMany({
      where,
      include: {
        stock: {
          select: {
            symbol: true,
            name: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
      skip: offset,
    });

    // モックデータを追加（データベースにデータがない場合）
    if (trades.length === 0) {
      const mockTrades = [
        {
          id: '1',
          timestamp: new Date('2024-01-10T14:32:15Z'),
          stock: { symbol: '7203.T', name: 'トヨタ自動車' },
          action: 'sell',
          quantity: 100,
          price: 2525,
          profit: 2500,
          strategy: 'モメンタム',
        },
        {
          id: '2',
          timestamp: new Date('2024-01-10T13:45:22Z'),
          stock: { symbol: '6758.T', name: 'ソニーグループ' },
          action: 'buy',
          quantity: 50,
          price: 12400,
          profit: -1200,
          strategy: '平均回帰',
        },
        {
          id: '3',
          timestamp: new Date('2024-01-10T11:20:33Z'),
          stock: { symbol: '9984.T', name: 'ソフトバンクグループ' },
          action: 'sell',
          quantity: 200,
          price: 1850,
          profit: 3200,
          strategy: 'ブレイクアウト',
        },
      ];

      return NextResponse.json({
        success: true,
        data: mockTrades,
        total: mockTrades.length,
      });
    }

    return NextResponse.json({
      success: true,
      data: trades,
      total: trades.length,
    });
  } catch (error) {
    console.error('Failed to fetch trade history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trade history' },
      { status: 500 }
    );
  }
}
