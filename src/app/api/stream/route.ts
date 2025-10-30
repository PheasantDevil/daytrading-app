import { NextRequest, NextResponse } from 'next/server';
import { getRealtimeDataStream } from '@/services/realtime-data-stream';

// サーバーサイドでのリアルタイムデータ管理
let dataStream: any = null;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    // データストリームを初期化
    if (!dataStream) {
      dataStream = getRealtimeDataStream({
        host: process.env.IB_HOST || '127.0.0.1',
        port: parseInt(process.env.IB_PORT || '7497'),
        clientId: parseInt(process.env.IB_CLIENT_ID || '1'),
        reconnectInterval: 5000,
        maxReconnectAttempts: 5,
      });

      await dataStream.connect();
    }

    // モック市場データを生成
    const basePrice = 100 + Math.random() * 200;
    const change = (Math.random() - 0.5) * 10;
    const changePercent = (change / basePrice) * 100;

    const marketData = {
      symbol,
      price: basePrice,
      bid: basePrice - 0.05,
      ask: basePrice + 0.05,
      volume: Math.floor(Math.random() * 1000000),
      timestamp: new Date().toISOString(),
      high24h: basePrice + Math.random() * 5,
      low24h: basePrice - Math.random() * 5,
      change24h: change,
      changePercent24h: changePercent,
    };

    return NextResponse.json({
      success: true,
      data: marketData,
    });
  } catch (error) {
    console.error('Failed to get market data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get market data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, symbols } = body;

    switch (action) {
      case 'subscribe':
        // 複数銘柄の市場データを取得
        if (!Array.isArray(symbols)) {
          return NextResponse.json(
            { success: false, error: 'Symbols must be an array' },
            { status: 400 }
          );
        }

        const marketDataList = symbols.map((symbol: string) => {
          const basePrice = 100 + Math.random() * 200;
          const change = (Math.random() - 0.5) * 10;
          const changePercent = (change / basePrice) * 100;

          return {
            symbol,
            price: basePrice,
            bid: basePrice - 0.05,
            ask: basePrice + 0.05,
            volume: Math.floor(Math.random() * 1000000),
            timestamp: new Date().toISOString(),
            high24h: basePrice + Math.random() * 5,
            low24h: basePrice - Math.random() * 5,
            change24h: change,
            changePercent24h: changePercent,
          };
        });

        return NextResponse.json({
          success: true,
          data: marketDataList,
        });

      case 'status':
        return NextResponse.json({
          success: true,
          data: {
            connected: dataStream?.getConnectionStatus() || false,
            subscriptions: dataStream?.getSubscriptionCount() || 0,
            timestamp: new Date().toISOString(),
          },
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Stream management error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
