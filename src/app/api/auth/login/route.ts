import { generateToken, verifyPassword } from '@/core/auth';
import { prisma } from '@/core/database';
import { LoginRequest } from '@/types';
import { createErrorResponse, createSuccessResponse } from '@/utils/api';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    // バリデーション
    if (!email || !password) {
      return NextResponse.json(
        createErrorResponse('Email and password are required'),
        { status: 400 }
      );
    }

    // ユーザー検索
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(createErrorResponse('Invalid credentials'), {
        status: 401,
      });
    }

    // パスワード検証
    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      return NextResponse.json(createErrorResponse('Invalid credentials'), {
        status: 401,
      });
    }

    // JWTトークン生成
    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    });

    return NextResponse.json(
      createSuccessResponse(
        {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            created_at: user.createdAt,
            updated_at: user.updatedAt,
          },
        },
        'Login successful'
      ),
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(createErrorResponse('Internal server error'), {
      status: 500,
    });
  }
}
