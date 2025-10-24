import { NextResponse } from 'next/server';
import { prisma } from '@/core/database';

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
