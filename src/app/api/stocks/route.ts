import { prisma } from '@/core/database';
import { createErrorResponse, createSuccessResponse } from '@/utils/api';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const market = searchParams.get('market');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = {};

    if (symbol) {
      where.symbol = {
        contains: symbol,
        mode: 'insensitive',
      };
    }

    if (market) {
      where.market = market;
    }

    const stocks = await prisma.stock.findMany({
      where,
      take: limit,
      orderBy: {
        symbol: 'asc',
      },
    });

    return NextResponse.json(createSuccessResponse(stocks), { status: 200 });
  } catch (error) {
    console.error('Stocks fetch error:', error);
    return NextResponse.json(createErrorResponse('Internal server error'), {
      status: 500,
    });
  }
}
