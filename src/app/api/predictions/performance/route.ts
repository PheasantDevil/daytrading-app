import { predictionService } from '@/lib/ml/prediction-service';
import { createErrorResponse, createSuccessResponse } from '@/utils/api';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const performances = await predictionService.getAllModelPerformance();

    return NextResponse.json(createSuccessResponse(performances), {
      status: 200,
    });
  } catch (error) {
    console.error('Performance fetch error:', error);
    return NextResponse.json(createErrorResponse('Internal server error'), {
      status: 500,
    });
  }
}
