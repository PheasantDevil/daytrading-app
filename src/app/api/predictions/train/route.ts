import { NextRequest, NextResponse } from 'next/server';
import { predictionService } from '@/lib/ml/prediction-service';
import { createSuccessResponse, createErrorResponse } from '@/utils/api';

export async function POST(request: NextRequest) {
  try {
    const { stockId } = await request.json();

    if (!stockId) {
      return NextResponse.json(
        createErrorResponse('Stock ID is required'),
        { status: 400 }
      );
    }

    // 非同期で学習を開始
    predictionService.trainModels(stockId).catch(error => {
      console.error('Training failed:', error);
    });

    return NextResponse.json(
      createSuccessResponse(null, 'Model training started'),
      { status: 200 }
    );
  } catch (error) {
    console.error('Training request error:', error);
    return NextResponse.json(
      createErrorResponse('Internal server error'),
      { status: 500 }
    );
  }
}
