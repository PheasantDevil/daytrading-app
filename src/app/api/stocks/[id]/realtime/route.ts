import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { stockDataSyncService } from '@/lib/stock-data-sync';
import { createSuccessResponse, createErrorResponse } from '@/utils/api';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const stockId = parseInt(params.id);

    if (isNaN(stockId)) {
      return NextResponse.json(
        createErrorResponse('Invalid stock ID'),
        { status: 400 }
      );
    }

    // 銘柄情報を取得
    const stock = await prisma.stock.findUnique({
      where: { id: stockId },
    });

    if (!stock) {
      return NextResponse.json(
        createErrorResponse('Stock not found'),
        { status: 404 }
      );
    }

    // キャッシュから最新価格を取得
    let realTimePrice = await stockDataSyncService.getCachedPrice(stockId);

    // キャッシュにない場合は新しく取得
    if (!realTimePrice) {
      realTimePrice = await stockDataSyncService.syncStockPrice(stockId, stock.symbol);
    }

    if (!realTimePrice) {
      return NextResponse.json(
        createErrorResponse('Failed to fetch real-time price'),
        { status: 500 }
      );
    }

    return NextResponse.json(
      createSuccessResponse(realTimePrice),
      { status: 200 }
    );
  } catch (error) {
    console.error('Real-time price fetch error:', error);
    return NextResponse.json(
      createErrorResponse('Internal server error'),
      { status: 500 }
    );
  }
}
