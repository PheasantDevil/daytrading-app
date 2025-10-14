import { verifyToken } from '@/core/auth';
import { prisma } from '@/core/database';
import { decryptSecuritiesCredentials } from '@/integrations/securities-encryption';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 証券口座接続テスト
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const accountId = parseInt(id);
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
      apiPassword: account.apiPassword || '',
      password: account.passwordHash || '',
    });

    // kabuステーションAPI接続テスト
    const connectionTest = await testKabuApiConnection({
      ...credentials,
      username: account.username,
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
 * kabuステーションAPI接続テスト
 */
async function testKabuApiConnection(credentials: {
  apiPassword: string;
  password: string;
  username: string;
  accountNumber: string;
}) {
  try {
    // kabuステーションAPI接続テストの実装
    // 実際のkabuステーションAPI仕様に基づいて実装する必要があります

    // デモ用の接続テスト（実際のAPI呼び出しは実装が必要）
    const testResponse = await fetch(
      'https://localhost:18080/kabusapi/v1/authentication',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': credentials.apiPassword,
        },
        body: JSON.stringify({
          UserId: credentials.username,
          Password: credentials.password,
        }),
      }
    );

    if (testResponse.ok) {
      return { success: true };
    } else {
      return {
        success: false,
        error: `API接続エラー: ${testResponse.status} ${testResponse.statusText}`,
      };
    }
  } catch (error) {
    console.error('kabuステーションAPI接続テストエラー:', error);
    return {
      success: false,
      error: 'API接続に失敗しました。認証情報を確認してください。',
    };
  }
}
