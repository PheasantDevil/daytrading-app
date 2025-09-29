import { tradingApiManager } from '@/services/trading-api-manager';
import { NextRequest, NextResponse } from 'next/server';

/**
 * デモ注文一覧取得
 */
export async function GET(request: NextRequest) {
  try {
    const orders = await tradingApiManager.getPositions();

    return NextResponse.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error('Demo orders fetch error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch demo orders' },
      { status: 500 }
    );
  }
}

/**
 * デモ注文発注
 */
export async function POST(request: NextRequest) {
  try {
    const { symbol, side, quantity, price } = await request.json();

    if (!symbol || !side || !quantity || !price) {
      return NextResponse.json(
        { success: false, message: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const result = await tradingApiManager.placeOrder(
      symbol,
      side,
      quantity,
      price
    );

    return NextResponse.json({
      success: result.success,
      data: result.data,
      source: result.source,
      message: result.success ? 'Order placed successfully' : result.error,
    });
  } catch (error) {
    console.error('Demo order placement error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to place order' },
      { status: 500 }
    );
  }
}
