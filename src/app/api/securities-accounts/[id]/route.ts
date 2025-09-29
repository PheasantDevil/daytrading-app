import { verifyToken } from '@/core/auth';
import { prisma } from '@/core/database';
import {
  decryptSecuritiesCredentials,
  encryptSecuritiesCredentials,
} from '@/integrations/securities-encryption';
import { UpdateSecuritiesAccountRequest } from '@/types/securities';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 特定の証券口座情報取得
 */
export async function GET(
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

    const account = await prisma.securitiesAccount.findFirst({
      where: {
        id: accountId,
        userId,
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

    if (!account) {
      return NextResponse.json(
        { success: false, message: '口座が見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: account,
    });
  } catch (error) {
    console.error('証券口座取得エラー:', error);
    return NextResponse.json(
      { success: false, message: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * 証券口座情報更新
 */
export async function PUT(
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

    const body: UpdateSecuritiesAccountRequest = await request.json();

    // 口座が存在するかチェック
    const existingAccount = await prisma.securitiesAccount.findFirst({
      where: {
        id: accountId,
        userId,
      },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { success: false, message: '口座が見つかりません' },
        { status: 404 }
      );
    }

    // 更新データの準備
    const updateData: any = {};

    // 認証情報が更新される場合は暗号化
    if (
      body.apiKey ||
      body.apiSecret ||
      body.password ||
      body.tradingPassword
    ) {
      const currentCredentials = {
        apiKey: existingAccount.apiKey,
        apiSecret: existingAccount.apiSecret,
        password: existingAccount.passwordHash,
        tradingPassword: existingAccount.tradingPasswordHash,
      };

      const decryptedCredentials =
        decryptSecuritiesCredentials(currentCredentials);

      const newCredentials = {
        apiKey: body.apiKey || decryptedCredentials.apiKey,
        apiSecret: body.apiSecret || decryptedCredentials.apiSecret,
        password: body.password || decryptedCredentials.password,
        tradingPassword:
          body.tradingPassword || decryptedCredentials.tradingPassword,
      };

      const encryptedCredentials = encryptSecuritiesCredentials(newCredentials);

      if (body.apiKey) updateData.apiKey = encryptedCredentials.apiKey;
      if (body.apiSecret) updateData.apiSecret = encryptedCredentials.apiSecret;
      if (body.password)
        updateData.passwordHash = encryptedCredentials.password;
      if (body.tradingPassword)
        updateData.tradingPasswordHash = encryptedCredentials.tradingPassword;
    }

    // その他のフィールド
    if (body.brokerName !== undefined) updateData.brokerName = body.brokerName;
    if (body.accountNumber !== undefined)
      updateData.accountNumber = body.accountNumber;
    if (body.username !== undefined) updateData.username = body.username;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    // 口座情報を更新
    const updatedAccount = await prisma.securitiesAccount.update({
      where: { id: accountId },
      data: updateData,
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
      data: updatedAccount,
      message: '口座情報が正常に更新されました',
    });
  } catch (error) {
    console.error('証券口座更新エラー:', error);
    return NextResponse.json(
      { success: false, message: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * 証券口座削除
 */
export async function DELETE(
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

    // 口座が存在するかチェック
    const existingAccount = await prisma.securitiesAccount.findFirst({
      where: {
        id: accountId,
        userId,
      },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { success: false, message: '口座が見つかりません' },
        { status: 404 }
      );
    }

    // 口座を削除
    await prisma.securitiesAccount.delete({
      where: { id: accountId },
    });

    return NextResponse.json({
      success: true,
      message: '口座が正常に削除されました',
    });
  } catch (error) {
    console.error('証券口座削除エラー:', error);
    return NextResponse.json(
      { success: false, message: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
