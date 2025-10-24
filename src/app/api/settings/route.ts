import { NextRequest, NextResponse } from 'next/server';

interface SystemSettings {
  ibHost: string;
  ibPort: number;
  ibClientId: number;
  ibAccountId: string;
  ibPaperTrading: boolean;
  maxDailyLoss: number;
  maxPositionSize: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  emailNotifications: boolean;
  lineNotifications: boolean;
  slackNotifications: boolean;
  dataRefreshInterval: number;
  maxDataRetentionDays: number;
  twoFactorAuth: boolean;
  sessionTimeout: number;
}

// メモリ内で設定を管理（本番環境ではDBを使用）
let systemSettings: SystemSettings = {
  ibHost: '127.0.0.1',
  ibPort: 7496,
  ibClientId: 1,
  ibAccountId: '',
  ibPaperTrading: false,
  maxDailyLoss: 50000,
  maxPositionSize: 100000,
  stopLossPercent: 3,
  takeProfitPercent: 5,
  emailNotifications: true,
  lineNotifications: false,
  slackNotifications: false,
  dataRefreshInterval: 5000,
  maxDataRetentionDays: 30,
  twoFactorAuth: false,
  sessionTimeout: 30,
};

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: systemSettings,
    });
  } catch (error) {
    console.error('Failed to get system settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get system settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 設定の更新
    systemSettings = { ...systemSettings, ...body };

    return NextResponse.json({
      success: true,
      data: systemSettings,
      message: 'Settings saved successfully',
    });
  } catch (error) {
    console.error('Failed to save system settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save system settings' },
      { status: 500 }
    );
  }
}
