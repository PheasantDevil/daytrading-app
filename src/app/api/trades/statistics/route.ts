import { NextResponse } from 'next/server';
import { prisma } from '@/core/database';

export async function GET() {
  try {
    // 統計情報を計算
    const trades = await prisma.trade.findMany({
      include: {
        stock: {
          select: {
            symbol: true,
            name: true,
          },
        },
      },
    });

    // モックデータを使用（データベースにデータがない場合）
    const mockTrades = [
      { profit: 2500, strategy: 'モメンタム' },
      { profit: -1200, strategy: '平均回帰' },
      { profit: 3200, strategy: 'ブレイクアウト' },
      { profit: 1500, strategy: 'モメンタム' },
      { profit: -800, strategy: '平均回帰' },
      { profit: 2100, strategy: 'ブレイクアウト' },
      { profit: 1800, strategy: 'モメンタム' },
      { profit: -500, strategy: '平均回帰' },
    ];

    const allTrades = trades.length > 0 ? trades : mockTrades;

    // 基本統計
    const totalTrades = allTrades.length;
    const totalProfit = allTrades.reduce((sum, trade) => sum + (trade.profit || 0), 0);
    const winningTrades = allTrades.filter(trade => (trade.profit || 0) > 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const maxProfit = Math.max(...allTrades.map(trade => trade.profit || 0));
    const maxLoss = Math.min(...allTrades.map(trade => trade.profit || 0));
    const averageProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;

    // 戦略別統計
    const strategyStats = allTrades.reduce((acc, trade) => {
      const strategy = trade.strategy || 'Unknown';
      if (!acc[strategy]) {
        acc[strategy] = {
          trades: 0,
          profit: 0,
          wins: 0,
        };
      }
      acc[strategy].trades++;
      acc[strategy].profit += trade.profit || 0;
      if ((trade.profit || 0) > 0) {
        acc[strategy].wins++;
      }
      return acc;
    }, {} as Record<string, { trades: number; profit: number; wins: number }>);

    const strategyPerformance = Object.entries(strategyStats).map(([strategy, stats]) => ({
      strategy,
      trades: stats.trades,
      profit: stats.profit,
      winRate: stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalTrades,
          totalProfit,
          winRate: Math.round(winRate * 100) / 100,
          maxProfit,
          maxLoss,
          averageProfit: Math.round(averageProfit * 100) / 100,
        },
        strategyPerformance,
      },
    });
  } catch (error) {
    console.error('Failed to calculate statistics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate statistics' },
      { status: 500 }
    );
  }
}
