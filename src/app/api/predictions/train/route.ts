import { NextRequest, NextResponse } from 'next/server';
import { EnsemblePredictor } from '@/ml/ensemble-predictor';
import { prisma } from '@/core/database';

// アンサンブル予測器のシングルトンインスタンス
let ensemblePredictor: EnsemblePredictor | null = null;

function getEnsemblePredictor(): EnsemblePredictor {
  if (!ensemblePredictor) {
    ensemblePredictor = new EnsemblePredictor();
  }
  return ensemblePredictor;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stockId, forceRetrain = false } = body;

    if (!stockId) {
      return NextResponse.json(
        { success: false, error: 'Stock ID is required' },
        { status: 400 }
      );
    }

    // 株価データを取得
    const stock = await prisma.stock.findUnique({
      where: { id: parseInt(stockId) },
    });

    if (!stock) {
      return NextResponse.json(
        { success: false, error: 'Stock not found' },
        { status: 404 }
      );
    }

    // 十分な履歴データを取得
    const historicalData = await prisma.stockPrice.findMany({
      where: { stockId: parseInt(stockId) },
      orderBy: { timestamp: 'asc' },
      take: 1000, // 十分なデータを取得
    });

    if (historicalData.length < 100) {
      return NextResponse.json(
        { success: false, error: 'Insufficient historical data for training' },
        { status: 400 }
      );
    }

    try {
      // アンサンブル予測器を取得
      const predictor = getEnsemblePredictor();

      // データを学習用の形式に変換
      const trainingData = {
        features: historicalData.map(price => [
          price.open,
          price.high,
          price.low,
          price.close,
          price.volume,
        ]),
        targets: historicalData.map(price => price.close),
        timestamps: historicalData.map(price => price.timestamp),
      };

      console.log(`Starting model training for ${stock.symbol}...`);
      console.log(`Training data size: ${trainingData.features.length} samples`);

      // モデルを学習
      const trainingResults = await predictor.train(trainingData);

      console.log('Model training completed:', trainingResults);

      // 学習結果を保存（簡易実装）
      const trainingRecord = {
        stockId: parseInt(stockId),
        symbol: stock.symbol,
        trainingDate: new Date(),
        dataSize: trainingData.features.length,
        results: trainingResults,
        status: 'completed',
      };

      return NextResponse.json({
        success: true,
        message: 'Model training completed successfully',
        data: trainingRecord,
      });
    } catch (trainingError) {
      console.error('Model training failed:', trainingError);
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Model training failed',
          details: trainingError instanceof Error ? trainingError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Training API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stockId = searchParams.get('stockId');

    if (!stockId) {
      return NextResponse.json(
        { success: false, error: 'Stock ID is required' },
        { status: 400 }
      );
    }

    // アンサンブル予測器の状態を取得
    const predictor = getEnsemblePredictor();
    const modelStatus = predictor.getModelStatus();

    return NextResponse.json({
      success: true,
      data: {
        stockId: parseInt(stockId),
        modelStatus,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Model status API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get model status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}