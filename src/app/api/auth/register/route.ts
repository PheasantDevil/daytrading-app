import { generateToken, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/database';
import { CreateUserRequest } from '@/types';
import { createErrorResponse, createSuccessResponse } from '@/utils/api';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body: CreateUserRequest = await request.json();
    const { email, password, name } = body;

    // バリデーション
    if (!email || !password || !name) {
      return NextResponse.json(
        createErrorResponse('Email, password, and name are required'),
        { status: 400 }
      );
    }

    // 既存ユーザーのチェック
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(createErrorResponse('User already exists'), {
        status: 409,
      });
    }

    // パスワードのハッシュ化
    const passwordHash = await hashPassword(password);

    // ユーザー作成
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
    });

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
        'User registered successfully'
      ),
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(createErrorResponse('Internal server error'), {
      status: 500,
    });
  }
}
