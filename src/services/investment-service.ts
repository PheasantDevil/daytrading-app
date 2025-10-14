import { prisma } from '@/core/database';
import {
  InvestmentPosition,
  InvestmentProduct,
  InvestmentTransaction,
} from '@/types/investment';

export class InvestmentService {
  /**
   * 投資商品を登録
   */
  async createProduct(productData: {
    symbol: string;
    name: string;
    type: string;
    currentPrice: number;
    currency?: string;
    minOrderSize?: number;
    tradingFee?: number;
    tradingFeeRate?: number;
  }): Promise<InvestmentProduct> {
    const product = await prisma.investmentProduct.create({
      data: {
        symbol: productData.symbol,
        name: productData.name,
        type: productData.type,
        currentPrice: productData.currentPrice,
        currency: productData.currency || 'JPY',
        minOrderSize: productData.minOrderSize || 1,
        tradingFee: productData.tradingFee || 0,
        tradingFeeRate: productData.tradingFeeRate || 0.1,
      },
    });

    return {
      ...product,
      type: product.type as InvestmentProduct['type'],
    };
  }

  /**
   * 投資商品一覧を取得
   */
  async getProducts(): Promise<InvestmentProduct[]> {
    const products = await prisma.investmentProduct.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return products.map((p) => ({
      ...p,
      type: p.type as InvestmentProduct['type'],
    }));
  }

  /**
   * 投資商品の詳細を取得
   */
  async getProduct(productId: string): Promise<InvestmentProduct | null> {
    const product = await prisma.investmentProduct.findUnique({
      where: { id: productId },
    });

    if (!product) return null;

    return {
      ...product,
      type: product.type as InvestmentProduct['type'],
    };
  }

  /**
   * 投資商品の価格を更新
   */
  async updateProductPrice(productId: string, newPrice: number): Promise<void> {
    await prisma.investmentProduct.update({
      where: { id: productId },
      data: {
        currentPrice: newPrice,
        updatedAt: new Date(),
      },
    });

    // 関連するポジションの評価額も更新
    await this.updatePositionValues(productId, newPrice);
  }

  /**
   * ポジション一覧を取得
   */
  async getPositions(): Promise<InvestmentPosition[]> {
    return await prisma.investmentPosition.findMany({
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 特定商品のポジションを取得
   */
  async getPosition(productId: string): Promise<InvestmentPosition | null> {
    return await prisma.investmentPosition.findFirst({
      where: { productId },
      include: { product: true },
    });
  }

  /**
   * 取引履歴を取得
   */
  async getTransactions(limit: number = 50): Promise<InvestmentTransaction[]> {
    return await prisma.investmentTransaction.findMany({
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * 特定商品の取引履歴を取得
   */
  async getProductTransactions(
    productId: string,
    limit: number = 20
  ): Promise<InvestmentTransaction[]> {
    return await prisma.investmentTransaction.findMany({
      where: { productId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * ポジションの評価額を更新
   */
  private async updatePositionValues(
    productId: string,
    currentPrice: number
  ): Promise<void> {
    const position = await prisma.investmentPosition.findFirst({
      where: { productId },
    });

    if (position) {
      const currentValue = position.quantity * currentPrice;
      const unrealizedPnl = currentValue - position.totalCost;
      const unrealizedPnlPercent =
        position.totalCost > 0 ? (unrealizedPnl / position.totalCost) * 100 : 0;

      await prisma.investmentPosition.update({
        where: { id: position.id },
        data: {
          currentPrice,
          currentValue,
          unrealizedPnl,
          unrealizedPnlPercent,
          updatedAt: new Date(),
        },
      });
    }
  }

  /**
   * 総資産を計算
   */
  async getTotalAssets(): Promise<{
    totalValue: number;
    totalCost: number;
    totalPnl: number;
    totalPnlPercent: number;
    positions: InvestmentPosition[];
  }> {
    const positions = await this.getPositions();

    const totalValue = positions.reduce(
      (sum, pos) => sum + pos.currentValue,
      0
    );
    const totalCost = positions.reduce((sum, pos) => sum + pos.totalCost, 0);
    const totalPnl = totalValue - totalCost;
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    return {
      totalValue,
      totalCost,
      totalPnl,
      totalPnlPercent,
      positions,
    };
  }

  /**
   * 損益レポートを生成
   */
  async generatePnLReport(): Promise<{
    summary: {
      totalTrades: number;
      buyTrades: number;
      sellTrades: number;
      totalFees: number;
      netPnL: number;
    };
    byProduct: Array<{
      product: InvestmentProduct;
      trades: InvestmentTransaction[];
      totalFees: number;
      netPnL: number;
    }>;
  }> {
    const transactions = await this.getTransactions(1000);
    const products = await this.getProducts();

    const summary = {
      totalTrades: transactions.length,
      buyTrades: transactions.filter((t) => t.type === 'BUY').length,
      sellTrades: transactions.filter((t) => t.type === 'SELL').length,
      totalFees: transactions.reduce((sum, t) => sum + t.fee, 0),
      netPnL: 0, // 実装が必要
    };

    const byProduct = products.map((product) => {
      const productTransactions = transactions.filter(
        (t) => t.productId === product.id
      );
      const totalFees = productTransactions.reduce((sum, t) => sum + t.fee, 0);
      const netPnL = 0; // 実装が必要

      return {
        product,
        trades: productTransactions,
        totalFees,
        netPnL,
      };
    });

    return { summary, byProduct };
  }

  /**
   * サンプル投資商品を作成
   */
  async createSampleProducts(): Promise<void> {
    const sampleProducts = [
      {
        symbol: '7203',
        name: 'トヨタ自動車',
        type: 'STOCK',
        currentPrice: 2500,
        tradingFee: 100,
        tradingFeeRate: 0.1,
      },
      {
        symbol: '1321',
        name: '日経平均レバレッジETF',
        type: 'ETF',
        currentPrice: 15000,
        tradingFee: 50,
        tradingFeeRate: 0.05,
      },
      {
        symbol: 'GOLD',
        name: '金現物',
        type: 'GOLD',
        currentPrice: 8500,
        tradingFee: 200,
        tradingFeeRate: 0.2,
      },
      {
        symbol: 'BTC',
        name: 'ビットコイン',
        type: 'CRYPTO',
        currentPrice: 5000000,
        tradingFee: 1000,
        tradingFeeRate: 0.1,
      },
      {
        symbol: 'NISA',
        name: 'NISA投資信託',
        type: 'MUTUAL_FUND',
        currentPrice: 10000,
        tradingFee: 0,
        tradingFeeRate: 0,
      },
    ];

    for (const productData of sampleProducts) {
      await this.createProduct(productData);
    }
  }
}

export const investmentService = new InvestmentService();
