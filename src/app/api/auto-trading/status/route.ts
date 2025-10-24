import { NextRequest, NextResponse } from 'next/server';

interface TradingStatus {
  isRunning: boolean;
  isPaused: boolean;
  todayTrades: number;
  todayProfit: number;
  activePositions: number;
}

// メモリ内でステータスを管理（本番環境ではRedisやDBを使用）
let tradingStatus: TradingStatus = {
  isRunning: false,
  isPaused: false,
  todayTrades: 0,
  todayProfit: 0,
  activePositions: 0,
};

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: tradingStatus,
    });
  } catch (error) {
    console.error('Failed to get trading status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get trading status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'start':
        tradingStatus = {
          ...tradingStatus,
          isRunning: true,
          isPaused: false,
        };
        break;
      case 'stop':
        tradingStatus = {
          ...tradingStatus,
          isRunning: false,
          isPaused: false,
        };
        break;
      case 'pause':
        tradingStatus = {
          ...tradingStatus,
          isPaused: true,
        };
        break;
      case 'resume':
        tradingStatus = {
          ...tradingStatus,
          isPaused: false,
        };
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: tradingStatus,
    });
  } catch (error) {
    console.error('Failed to update trading status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update trading status' },
      { status: 500 }
    );
  }
}
