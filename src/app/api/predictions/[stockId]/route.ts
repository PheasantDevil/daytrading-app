import { NextRequest, NextResponse } from 'next/server';
import { predictionService } from '@/lib/ml/prediction-service';
import { createSuccessResponse, createErrorResponse } from '@/utils/api';

export async function GET(
  request: NextRequest,
  { params }: { params: { stockId: string } }
) {
  try {
    const stockId = parseInt(params.stockId);

    if (isNaN(stockId)) {
      return NextResponse.json(
        createErrorResponse('Invalid stock ID'),
        { status: 400 }
      );
    }

    const predictions = await predictionService.predict(stockId);

    return NextResponse.json(
      createSuccessResponse(predictions),
      { status: 200 }
    );
  } catch (error) {
    console.error('Prediction error:', error);
    return NextResponse.json(
      createErrorResponse('Internal server error'),
      { status: 500 }
    );
  }
}
