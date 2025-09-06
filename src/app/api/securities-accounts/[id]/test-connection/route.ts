import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/database';
import { decryptSecuritiesCredentials } from '@/lib/securities-encryption';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 証券口座接続テスト
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json(
        { success: false, message: '認証トークンが必要です' },
        { status: 401 }
      );
    }

    const userId = await verifyToken(token);
    if (!userId) {
      return NextResponse.json(
        { success: false, message: '無効な認証トークンです' },
        { status: 401 }
      );
    }

    const accountId = parseInt(params.id);
    if (isNaN(accountId)) {
      return NextResponse.json(
        { success: false, message: '無効な口座IDです' },
        { status: 400 }
      );
    }

    // 口座情報を取得
    const account = await prisma.securitiesAccount.findFirst({
      where: {
        id: accountId,
        userId,
      },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, message: '口座が見つかりません' },
        { status: 404 }
      );
    }

    // 認証情報を復号化
    const credentials = decryptSecuritiesCredentials({
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      password: account.passwordHash,
      tradingPassword: account.tradingPasswordHash,
    });

    // SBI証券API接続テスト
    const connectionTest = await testSbiApiConnection({
      ...credentials,
      accountNumber: account.accountNumber,
    });

    // 接続テスト結果に基づいて口座情報を更新
    await prisma.securitiesAccount.update({
      where: { id: accountId },
      data: {
        lastConnected: connectionTest.success ? new Date() : null,
        isActive: connectionTest.success,
      },
    });

    return NextResponse.json({
      success: connectionTest.success,
      message: connectionTest.success
        ? '接続テストが成功しました'
        : connectionTest.error,
      data: {
        brokerName: account.brokerName,
        accountNumber: account.accountNumber,
        lastConnected: connectionTest.success
          ? new Date()
          : account.lastConnected,
        isActive: connectionTest.success,
      },
    });
  } catch (error) {
    console.error('証券口座接続テストエラー:', error);
    return NextResponse.json(
      { success: false, message: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * SBI証券API接続テスト
 */
async function testSbiApiConnection(credentials: {
  apiKey: string;
  apiSecret: string;
  username: string;
  password: string;
  tradingPassword: string;
  accountNumber: string;
}) {
  try {
    // SBI証券API接続テストの実装
    // 実際のSBI証券API仕様に基づいて実装する必要があります

    // デモ用の接続テスト（実際のAPI呼び出しは実装が必要）
    const testResponse = await fetch('https://api.sbisec.co.jp/api/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credentials.apiKey}`,
      },
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password,
        accountNumber: credentials.accountNumber,
      }),
    });

    if (testResponse.ok) {
      return { success: true };
    } else {
      return {
        success: false,
        error: `API接続エラー: ${testResponse.status} ${testResponse.statusText}`,
      };
    }
  } catch (error) {
    console.error('SBI証券API接続テストエラー:', error);
    return {
      success: false,
      error: 'API接続に失敗しました。認証情報を確認してください。',
    };
  }
}
