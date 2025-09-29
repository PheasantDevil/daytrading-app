import { verifyToken } from '@/core/auth';
import { prisma } from '@/core/database';
import { encryptSecuritiesCredentials } from '@/integrations/securities-encryption';
import { CreateSecuritiesAccountRequest } from '@/types/securities';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 証券口座一覧取得
 */
export async function GET(request: NextRequest) {
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

    const accounts = await prisma.securitiesAccount.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        brokerName: true,
        accountNumber: true,
        username: true,
        isActive: true,
        deviceRegistered: true,
        lastConnected: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    console.error('証券口座一覧取得エラー:', error);
    return NextResponse.json(
      { success: false, message: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * 証券口座登録
 */
export async function POST(request: NextRequest) {
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

    const body: CreateSecuritiesAccountRequest = await request.json();
    const { brokerName, accountNumber, apiPassword, username, password } = body;

    // バリデーション
    if (
      !brokerName ||
      !accountNumber ||
      !apiPassword ||
      !username ||
      !password
    ) {
      return NextResponse.json(
        { success: false, message: '必須項目が不足しています' },
        { status: 400 }
      );
    }

    // 同じ証券会社の口座が既に登録されているかチェック
    const existingAccount = await prisma.securitiesAccount.findFirst({
      where: {
        userId,
        brokerName,
        accountNumber,
      },
    });

    if (existingAccount) {
      return NextResponse.json(
        { success: false, message: 'この口座は既に登録されています' },
        { status: 409 }
      );
    }

    // 認証情報を暗号化
    const encryptedCredentials = encryptSecuritiesCredentials({
      apiPassword,
      password,
    });

    // 証券口座を登録
    const account = await prisma.securitiesAccount.create({
      data: {
        userId,
        brokerName,
        accountNumber,
        apiPassword: encryptedCredentials.apiPassword,
        username,
        passwordHash: encryptedCredentials.password,
      },
      select: {
        id: true,
        userId: true,
        brokerName: true,
        accountNumber: true,
        username: true,
        isActive: true,
        deviceRegistered: true,
        lastConnected: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: account,
      message: '証券口座が正常に登録されました',
    });
  } catch (error) {
    console.error('証券口座登録エラー:', error);
    return NextResponse.json(
      { success: false, message: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
