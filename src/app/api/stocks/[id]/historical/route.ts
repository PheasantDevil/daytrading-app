import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stockId = searchParams.get('stockId');
    const symbol = searchParams.get('symbol');
    const duration = searchParams.get('duration') || '1D';
    const barSize = searchParams.get('barSize') || '1min';
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!stockId && !symbol) {
      return NextResponse.json(
        { success: false, error: 'stockId or symbol parameter is required' },
        { status: 400 }
      );
    }

    // 実際の実装では、Interactive Brokers APIから履歴データを取得
    // 現在はモックデータを生成
    
    const mockHistoricalData = [];
    const now = new Date();
    const basePrice = 100 + Math.random() * 200;
    
    // バーサイズに応じて時間間隔を設定
    let intervalMs = 60000; // 1分
    switch (barSize) {
      case '1min':
        intervalMs = 60000;
        break;
      case '5min':
        intervalMs = 300000;
        break;
      case '15min':
        intervalMs = 900000;
        break;
      case '1hour':
        intervalMs = 3600000;
        break;
      case '1day':
        intervalMs = 86400000;
        break;
    }

    // 期間に応じてデータポイント数を設定
    let dataPoints = limit;
    switch (duration) {
      case '1D':
        dataPoints = Math.min(limit, 24 * 60); // 1日分の1分足
        break;
      case '1W':
        dataPoints = Math.min(limit, 7 * 24 * 60); // 1週間分の1分足
        break;
      case '1M':
        dataPoints = Math.min(limit, 30 * 24 * 60); // 1ヶ月分の1分足
        break;
    }

    for (let i = 0; i < dataPoints; i++) {
      const timestamp = new Date(now.getTime() - i * intervalMs);
      const priceVariation = (Math.random() - 0.5) * 10;
      const open = basePrice + priceVariation;
      const close = open + (Math.random() - 0.5) * 5;
      const high = Math.max(open, close) + Math.random() * 3;
      const low = Math.min(open, close) - Math.random() * 3;
      const volume = Math.floor(Math.random() * 1000000);

      mockHistoricalData.push({
        timestamp: timestamp.toISOString(),
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
        volume: volume,
      });
    }

    // 時系列順にソート（古い順）
    mockHistoricalData.reverse();

    return NextResponse.json({
      success: true,
      data: mockHistoricalData,
      metadata: {
        symbol: symbol || `STOCK_${stockId}`,
        duration,
        barSize,
        count: mockHistoricalData.length,
        startTime: mockHistoricalData[0]?.timestamp,
        endTime: mockHistoricalData[mockHistoricalData.length - 1]?.timestamp,
      },
    });
  } catch (error) {
    console.error('Failed to get historical data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get historical data' },
      { status: 500 }
    );
  }
}
