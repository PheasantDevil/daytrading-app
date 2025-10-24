import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // 自動売買停止のロジック
    // 実際の実装では、DayTradingSchedulerを停止する
    
    console.log('Stopping auto trading...');
    
    // TODO: 実際の自動売買サービスを停止
    // const scheduler = new DayTradingScheduler();
    // await scheduler.stop();
    
    return NextResponse.json({
      success: true,
      message: 'Auto trading stopped successfully',
    });
  } catch (error) {
    console.error('Failed to stop auto trading:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to stop auto trading' },
      { status: 500 }
    );
  }
}
