import crypto from 'crypto';

const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || 'your-32-character-secret-key-here';
const ALGORITHM = 'aes-256-cbc';

/**
 * 文字列を暗号化
 */
export function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * 暗号化された文字列を復号化
 */
export function decrypt(encryptedText: string): string {
  try {
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedData = textParts.join(':');
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * API認証情報を暗号化して保存
 */
export function encryptSecuritiesCredentials(credentials: {
  apiKey: string;
  apiSecret: string;
  password: string;
  tradingPassword: string;
}) {
  return {
    apiKey: encrypt(credentials.apiKey),
    apiSecret: encrypt(credentials.apiSecret),
    password: encrypt(credentials.password),
    tradingPassword: encrypt(credentials.tradingPassword),
  };
}

/**
 * 暗号化されたAPI認証情報を復号化
 */
export function decryptSecuritiesCredentials(encryptedCredentials: {
  apiKey: string;
  apiSecret: string;
  password: string;
  tradingPassword: string;
}) {
  return {
    apiKey: decrypt(encryptedCredentials.apiKey),
    apiSecret: decrypt(encryptedCredentials.apiSecret),
    password: decrypt(encryptedCredentials.password),
    tradingPassword: decrypt(encryptedCredentials.tradingPassword),
  };
}
