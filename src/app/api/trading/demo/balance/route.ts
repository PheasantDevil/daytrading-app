import { tradingApiManager } from '@/services/trading-api-manager';
import { NextRequest, NextResponse } from 'next/server';

/**
 * デモ口座残高取得
 */
export async function GET(request: NextRequest) {
  try {
    const balance = await tradingApiManager.getBalance();

    return NextResponse.json({
      success: true,
      data: balance,
    });
  } catch (error) {
    console.error('Demo balance fetch error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}
