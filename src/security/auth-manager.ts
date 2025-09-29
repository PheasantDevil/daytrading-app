/**
 * 認証・認可管理サービス
 * ユーザー認証、認可、セッション管理
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  role: 'USER' | 'ADMIN' | 'TRADER' | 'VIEWER';
  permissions: string[];
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  mfaEnabled: boolean;
  mfaSecret?: string;
}

export interface Credentials {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  lastAccessed: Date;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isDefault: boolean;
}

export interface MFASetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface AuthConfig {
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
    issuer: string;
    audience: string;
  };
  password: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
  session: {
    maxSessions: number;
    sessionTimeout: number; // ミリ秒
    rememberMeDuration: number; // ミリ秒
  };
  mfa: {
    enabled: boolean;
    issuer: string;
    algorithm: 'SHA1' | 'SHA256' | 'SHA512';
    digits: number;
    period: number;
  };
  security: {
    maxLoginAttempts: number;
    lockoutDuration: number; // ミリ秒
    requireEmailVerification: boolean;
    passwordResetExpiry: number; // ミリ秒
  };
}

export class AuthManager {
  private config: AuthConfig;
  private users: Map<string, User> = new Map();
  private sessions: Map<string, Session> = new Map();
  private permissions: Map<string, Permission> = new Map();
  private roles: Map<string, Role> = new Map();
  private loginAttempts: Map<string, { count: number; lastAttempt: Date }> =
    new Map();
  private passwordResetTokens: Map<
    string,
    { userId: string; expiresAt: Date }
  > = new Map();

  constructor(config: AuthConfig) {
    this.config = config;
    this.initializeDefaultRoles();
    this.initializeDefaultPermissions();
  }

  /**
   * 認証管理を初期化
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🔄 認証管理初期化中...');

      // デフォルトユーザーを作成
      await this.createDefaultUsers();

      console.log('✅ 認証管理初期化完了');
      return true;
    } catch (error) {
      console.error('❌ 認証管理初期化エラー:', error);
      return false;
    }
  }

  /**
   * ユーザーを認証
   */
  async authenticate(credentials: Credentials): Promise<AuthResult> {
    try {
      // ログイン試行回数をチェック
      const attemptKey = credentials.email;
      const attempts = this.loginAttempts.get(attemptKey);

      if (attempts && attempts.count >= this.config.security.maxLoginAttempts) {
        const lockoutTime =
          attempts.lastAttempt.getTime() + this.config.security.lockoutDuration;
        if (Date.now() < lockoutTime) {
          return {
            success: false,
            error:
              'アカウントがロックされています。しばらくしてから再試行してください。',
          };
        } else {
          // ロックアウト期間が過ぎた場合はリセット
          this.loginAttempts.delete(attemptKey);
        }
      }

      // ユーザーを検索
      const user = Array.from(this.users.values()).find(
        (u) => u.email === credentials.email
      );
      if (!user) {
        this.recordLoginAttempt(attemptKey, false);
        return {
          success: false,
          error: '無効な認証情報です。',
        };
      }

      // アカウントがアクティブかチェック
      if (!user.isActive) {
        return {
          success: false,
          error: 'アカウントが無効化されています。',
        };
      }

      // パスワードを検証
      const isPasswordValid = await bcrypt.compare(
        credentials.password,
        user.passwordHash
      );
      if (!isPasswordValid) {
        this.recordLoginAttempt(attemptKey, false);
        return {
          success: false,
          error: '無効な認証情報です。',
        };
      }

      // MFAをチェック
      if (user.mfaEnabled) {
        if (!credentials.mfaCode) {
          return {
            success: false,
            error: 'MFAコードが必要です。',
          };
        }

        const isMfaValid = this.verifyMFACode(
          user.mfaSecret!,
          credentials.mfaCode
        );
        if (!isMfaValid) {
          this.recordLoginAttempt(attemptKey, false);
          return {
            success: false,
            error: '無効なMFAコードです。',
          };
        }
      }

      // ログイン成功
      this.recordLoginAttempt(attemptKey, true);
      this.loginAttempts.delete(attemptKey);

      // トークンを生成
      const token = this.generateToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // セッションを作成
      const session = await this.createSession(user.id, token, refreshToken);

      // ユーザーの最終ログイン時間を更新
      user.lastLogin = new Date();
      this.users.set(user.id, user);

      return {
        success: true,
        user: this.sanitizeUser(user),
        token,
        refreshToken,
        expiresIn: this.parseExpiresIn(this.config.jwt.expiresIn),
      };
    } catch (error) {
      console.error('❌ 認証エラー:', error);
      return {
        success: false,
        error: '認証中にエラーが発生しました。',
      };
    }
  }

  /**
   * トークンを検証
   */
  async verifyToken(
    token: string
  ): Promise<{ valid: boolean; user?: User; error?: string }> {
    try {
      const decoded = jwt.verify(token, this.config.jwt.secret) as any;
      const user = this.users.get(decoded.userId);

      if (!user || !user.isActive) {
        return { valid: false, error: 'ユーザーが見つからないか、無効です。' };
      }

      return { valid: true, user: this.sanitizeUser(user) };
    } catch (error) {
      return { valid: false, error: '無効なトークンです。' };
    }
  }

  /**
   * リフレッシュトークンを使用して新しいトークンを生成
   */
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      const session = Array.from(this.sessions.values()).find(
        (s) => s.refreshToken === refreshToken
      );

      if (!session || !session.isActive || session.expiresAt < new Date()) {
        return {
          success: false,
          error: '無効なリフレッシュトークンです。',
        };
      }

      const user = this.users.get(session.userId);
      if (!user || !user.isActive) {
        return {
          success: false,
          error: 'ユーザーが見つからないか、無効です。',
        };
      }

      // 新しいトークンを生成
      const newToken = this.generateToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      // セッションを更新
      session.token = newToken;
      session.refreshToken = newRefreshToken;
      session.expiresAt = new Date(
        Date.now() + this.parseExpiresIn(this.config.jwt.refreshExpiresIn)
      );
      session.lastAccessed = new Date();
      this.sessions.set(session.id, session);

      return {
        success: true,
        user: this.sanitizeUser(user),
        token: newToken,
        refreshToken: newRefreshToken,
        expiresIn: this.parseExpiresIn(this.config.jwt.expiresIn),
      };
    } catch (error) {
      console.error('❌ トークンリフレッシュエラー:', error);
      return {
        success: false,
        error: 'トークンリフレッシュ中にエラーが発生しました。',
      };
    }
  }

  /**
   * ユーザーを認可
   */
  async authorize(
    user: User,
    resource: string,
    action: string
  ): Promise<boolean> {
    try {
      // 管理者は全ての権限を持つ
      if (user.role === 'ADMIN') {
        return true;
      }

      // ユーザーの権限をチェック
      const hasPermission = user.permissions.some((permissionId) => {
        const permission = this.permissions.get(permissionId);
        return (
          permission &&
          permission.resource === resource &&
          permission.action === action
        );
      });

      return hasPermission;
    } catch (error) {
      console.error('❌ 認可エラー:', error);
      return false;
    }
  }

  /**
   * ユーザーを作成
   */
  async createUser(
    userData: Omit<
      User,
      | 'id'
      | 'passwordHash'
      | 'createdAt'
      | 'updatedAt'
      | 'mfaEnabled'
      | 'mfaSecret'
    >,
    password: string
  ): Promise<User> {
    try {
      const userId = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(password, 12);

      const user: User = {
        id: userId,
        passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
        mfaEnabled: false,
        ...userData,
      };

      this.users.set(userId, user);
      console.log(`✅ ユーザー作成: ${user.email}`);
      return this.sanitizeUser(user);
    } catch (error) {
      console.error('❌ ユーザー作成エラー:', error);
      throw error;
    }
  }

  /**
   * MFAを有効化
   */
  async enableMFA(userId: string): Promise<MFASetup> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('ユーザーが見つかりません');
      }

      const secret = this.generateMFASecret();
      const qrCode = this.generateQRCode(user.email, secret);
      const backupCodes = this.generateBackupCodes();

      user.mfaEnabled = true;
      user.mfaSecret = secret;
      user.updatedAt = new Date();
      this.users.set(userId, user);

      console.log(`✅ MFA有効化: ${user.email}`);

      return {
        secret,
        qrCode,
        backupCodes,
      };
    } catch (error) {
      console.error('❌ MFA有効化エラー:', error);
      throw error;
    }
  }

  /**
   * MFAを無効化
   */
  async disableMFA(userId: string): Promise<void> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('ユーザーが見つかりません');
      }

      user.mfaEnabled = false;
      user.mfaSecret = undefined;
      user.updatedAt = new Date();
      this.users.set(userId, user);

      console.log(`✅ MFA無効化: ${user.email}`);
    } catch (error) {
      console.error('❌ MFA無効化エラー:', error);
      throw error;
    }
  }

  /**
   * セッションを作成
   */
  private async createSession(
    userId: string,
    token: string,
    refreshToken: string
  ): Promise<Session> {
    const sessionId = crypto.randomUUID();
    const now = new Date();

    const session: Session = {
      id: sessionId,
      userId,
      token,
      refreshToken,
      expiresAt: new Date(
        now.getTime() + this.parseExpiresIn(this.config.jwt.refreshExpiresIn)
      ),
      createdAt: now,
      lastAccessed: now,
      ipAddress: '127.0.0.1', // 簡略化
      userAgent: 'Unknown', // 簡略化
      isActive: true,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * トークンを生成
   */
  private generateToken(user: User): string {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    };

    return jwt.sign(payload, this.config.jwt.secret, {
      expiresIn: this.config.jwt.expiresIn,
      issuer: this.config.jwt.issuer,
      audience: this.config.jwt.audience,
    });
  }

  /**
   * リフレッシュトークンを生成
   */
  private generateRefreshToken(user: User): string {
    const payload = {
      userId: user.id,
      type: 'refresh',
    };

    return jwt.sign(payload, this.config.jwt.secret, {
      expiresIn: this.config.jwt.refreshExpiresIn,
      issuer: this.config.jwt.issuer,
      audience: this.config.jwt.audience,
    });
  }

  /**
   * MFAシークレットを生成
   */
  private generateMFASecret(): string {
    return crypto.randomBytes(20).toString('base32');
  }

  /**
   * QRコードを生成
   */
  private generateQRCode(email: string, secret: string): string {
    const otpauth = `otpauth://totp/${this.config.mfa.issuer}:${email}?secret=${secret}&issuer=${this.config.mfa.issuer}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauth)}`;
  }

  /**
   * バックアップコードを生成
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  /**
   * MFAコードを検証
   */
  private verifyMFACode(secret: string, code: string): boolean {
    // 簡略化されたMFA検証
    const expectedCode = this.generateMFACode(secret);
    return code === expectedCode;
  }

  /**
   * MFAコードを生成
   */
  private generateMFACode(secret: string): string {
    // 簡略化されたMFAコード生成
    const time = Math.floor(Date.now() / 1000 / this.config.mfa.period);
    const hash = crypto
      .createHmac('sha1', Buffer.from(secret, 'base32'))
      .update(Buffer.from(time.toString(16).padStart(16, '0'), 'hex'))
      .digest();

    const offset = hash[hash.length - 1] & 0xf;
    const code =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    return (code % 1000000).toString().padStart(6, '0');
  }

  /**
   * ログイン試行を記録
   */
  private recordLoginAttempt(email: string, success: boolean): void {
    if (success) {
      this.loginAttempts.delete(email);
    } else {
      const attempts = this.loginAttempts.get(email) || {
        count: 0,
        lastAttempt: new Date(),
      };
      attempts.count++;
      attempts.lastAttempt = new Date();
      this.loginAttempts.set(email, attempts);
    }
  }

  /**
   * ユーザー情報をサニタイズ
   */
  private sanitizeUser(user: User): User {
    const { passwordHash, mfaSecret, ...sanitized } = user;
    return sanitized;
  }

  /**
   * 有効期限を解析
   */
  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 3600; // デフォルト1時間

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 3600;
    }
  }

  /**
   * デフォルトロールを初期化
   */
  private initializeDefaultRoles(): void {
    const defaultRoles: Role[] = [
      {
        id: 'admin',
        name: 'Administrator',
        description: 'システム管理者',
        permissions: ['*'],
        isDefault: false,
      },
      {
        id: 'trader',
        name: 'Trader',
        description: 'トレーダー',
        permissions: [
          'trading:read',
          'trading:write',
          'portfolio:read',
          'portfolio:write',
        ],
        isDefault: false,
      },
      {
        id: 'viewer',
        name: 'Viewer',
        description: '閲覧者',
        permissions: ['portfolio:read', 'reports:read'],
        isDefault: true,
      },
    ];

    for (const role of defaultRoles) {
      this.roles.set(role.id, role);
    }
  }

  /**
   * デフォルト権限を初期化
   */
  private initializeDefaultPermissions(): void {
    const defaultPermissions: Permission[] = [
      {
        id: 'trading:read',
        name: 'Trading Read',
        description: '取引情報の閲覧',
        resource: 'trading',
        action: 'read',
      },
      {
        id: 'trading:write',
        name: 'Trading Write',
        description: '取引の実行',
        resource: 'trading',
        action: 'write',
      },
      {
        id: 'portfolio:read',
        name: 'Portfolio Read',
        description: 'ポートフォリオの閲覧',
        resource: 'portfolio',
        action: 'read',
      },
      {
        id: 'portfolio:write',
        name: 'Portfolio Write',
        description: 'ポートフォリオの編集',
        resource: 'portfolio',
        action: 'write',
      },
      {
        id: 'reports:read',
        name: 'Reports Read',
        description: 'レポートの閲覧',
        resource: 'reports',
        action: 'read',
      },
    ];

    for (const permission of defaultPermissions) {
      this.permissions.set(permission.id, permission);
    }
  }

  /**
   * デフォルトユーザーを作成
   */
  private async createDefaultUsers(): Promise<void> {
    const adminUser = await this.createUser(
      {
        email: 'admin@example.com',
        username: 'admin',
        role: 'ADMIN',
        permissions: ['*'],
        isActive: true,
      },
      'admin123'
    );

    const traderUser = await this.createUser(
      {
        email: 'trader@example.com',
        username: 'trader',
        role: 'TRADER',
        permissions: [
          'trading:read',
          'trading:write',
          'portfolio:read',
          'portfolio:write',
        ],
        isActive: true,
      },
      'trader123'
    );

    console.log('✅ デフォルトユーザー作成完了');
  }

  /**
   * ユーザーを取得
   */
  getUser(userId: string): User | undefined {
    const user = this.users.get(userId);
    return user ? this.sanitizeUser(user) : undefined;
  }

  /**
   * 全ユーザーを取得
   */
  getAllUsers(): User[] {
    return Array.from(this.users.values()).map((user) =>
      this.sanitizeUser(user)
    );
  }

  /**
   * セッションを取得
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 全セッションを取得
   */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * セッションを無効化
   */
  invalidateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.sessions.set(sessionId, session);
      console.log(`✅ セッション無効化: ${sessionId}`);
    }
  }

  /**
   * 認証管理を停止
   */
  stop(): void {
    console.log('⏹️ 認証管理停止');
  }
}
