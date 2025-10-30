import { NextRequest, NextResponse } from 'next/server';

interface TradingConfig {
  strategies: {
    momentum: boolean;
    meanReversion: boolean;
    breakout: boolean;
  };
  riskSettings: {
    maxDailyLoss: number;
    positionSizePercent: number;
    stopLossPercent: number;
    takeProfitPercent: number;
  };
}

// メモリ内で設定を管理（本番環境ではDBを使用）
let tradingConfig: TradingConfig = {
  strategies: {
    momentum: true,
    meanReversion: false,
    breakout: true,
  },
  riskSettings: {
    maxDailyLoss: 50000,
    positionSizePercent: 10,
    stopLossPercent: 3,
    takeProfitPercent: 5,
  },
};

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: tradingConfig,
    });
  } catch (error) {
    console.error('Failed to get trading config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get trading config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 設定の更新
    if (body.strategies) {
      tradingConfig.strategies = {
        ...tradingConfig.strategies,
        ...body.strategies,
      };
    }

    if (body.riskSettings) {
      tradingConfig.riskSettings = {
        ...tradingConfig.riskSettings,
        ...body.riskSettings,
      };
    }

    return NextResponse.json({
      success: true,
      data: tradingConfig,
    });
  } catch (error) {
    console.error('Failed to update trading config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update trading config' },
      { status: 500 }
    );
  }
}
