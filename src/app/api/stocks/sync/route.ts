import { stockDataSyncService } from '@/lib/stock-data-sync';
import { createErrorResponse, createSuccessResponse } from '@/utils/api';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { action, stockId, symbol } = await request.json();

    switch (action) {
      case 'sync_all':
        // 全銘柄の同期（非同期で実行）
        stockDataSyncService.syncAllStockPrices();
        return NextResponse.json(
          createSuccessResponse(null, 'Stock data sync started'),
          { status: 200 }
        );

      case 'sync_single':
        if (!stockId || !symbol) {
          return NextResponse.json(
            createErrorResponse('Stock ID and symbol are required'),
            { status: 400 }
          );
        }

        const result = await stockDataSyncService.syncStockPrice(
          stockId,
          symbol
        );
        return NextResponse.json(
          createSuccessResponse(result, 'Stock price synced'),
          { status: 200 }
        );

      case 'sync_historical':
        if (!stockId || !symbol) {
          return NextResponse.json(
            createErrorResponse('Stock ID and symbol are required'),
            { status: 400 }
          );
        }

        const { days = 30 } = await request.json();
        await stockDataSyncService.syncHistoricalData(stockId, symbol, days);
        return NextResponse.json(
          createSuccessResponse(null, 'Historical data synced'),
          { status: 200 }
        );

      default:
        return NextResponse.json(createErrorResponse('Invalid action'), {
          status: 400,
        });
    }
  } catch (error) {
    console.error('Stock sync error:', error);
    return NextResponse.json(createErrorResponse('Internal server error'), {
      status: 500,
    });
  }
}
