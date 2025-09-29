import { prisma } from '@/core/database';
import { createErrorResponse, createSuccessResponse } from '@/utils/api';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const stockId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (isNaN(stockId)) {
      return NextResponse.json(createErrorResponse('Invalid stock ID'), {
        status: 400,
      });
    }

    const where: any = {
      stockId,
    };

    if (from || to) {
      where.timestamp = {};
      if (from) {
        where.timestamp.gte = new Date(from);
      }
      if (to) {
        where.timestamp.lte = new Date(to);
      }
    }

    const prices = await prisma.stockPrice.findMany({
      where,
      take: limit,
      orderBy: {
        timestamp: 'desc',
      },
    });

    return NextResponse.json(createSuccessResponse(prices), { status: 200 });
  } catch (error) {
    console.error('Stock prices fetch error:', error);
    return NextResponse.json(createErrorResponse('Internal server error'), {
      status: 500,
    });
  }
}
