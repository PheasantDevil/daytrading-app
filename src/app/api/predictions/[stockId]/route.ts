import { simplePredictor } from '@/ml/simple-predictor';
import { createErrorResponse, createSuccessResponse } from '@/utils/api';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stockId: string }> }
) {
  try {
    const { stockId: stockIdParam } = await params;
    const stockId = parseInt(stockIdParam);

    if (isNaN(stockId)) {
      return NextResponse.json(createErrorResponse('Invalid stock ID'), {
        status: 400,
      });
    }

    const predictions = await simplePredictor.predict(stockId);

    return NextResponse.json(createSuccessResponse(predictions), {
      status: 200,
    });
  } catch (error) {
    console.error('Prediction error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      createErrorResponse(
        `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`
      ),
      {
        status: 500,
      }
    );
  }
}
