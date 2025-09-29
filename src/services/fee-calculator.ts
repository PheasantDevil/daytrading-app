/**
 * 証券取引手数料計算サービス
 * 日本の主要証券会社の手数料体系を反映した精密な計算
 */

export interface FeeStructure {
  company: string;
  minFee: number;
  maxFee: number;
  rates: Array<{
    minAmount: number;
    maxAmount: number;
    rate: number;
  }>;
}

export interface FeeCalculationResult {
  commission: number;
  tax: number;
  total: number;
  breakdown: {
    baseCommission: number;
    tax: number;
    total: number;
  };
}

export class FeeCalculator {
  private static readonly FEE_STRUCTURES: Record<string, FeeStructure> = {
    sbi: {
      company: 'SBI証券',
      minFee: 0,
      maxFee: 0,
      rates: [
        { minAmount: 0, maxAmount: 100000, rate: 0.0 },
        { minAmount: 100000, maxAmount: 300000, rate: 0.0 },
        { minAmount: 300000, maxAmount: 500000, rate: 0.0 },
        { minAmount: 500000, maxAmount: 1000000, rate: 0.0 },
        { minAmount: 1000000, maxAmount: 3000000, rate: 0.0 },
        { minAmount: 3000000, maxAmount: 5000000, rate: 0.0 },
        { minAmount: 5000000, maxAmount: 10000000, rate: 0.0 },
        { minAmount: 10000000, maxAmount: Infinity, rate: 0.0 },
      ],
    },
    rakuten: {
      company: '楽天証券',
      minFee: 0,
      maxFee: 0,
      rates: [
        { minAmount: 0, maxAmount: 100000, rate: 0.0 },
        { minAmount: 100000, maxAmount: 300000, rate: 0.0 },
        { minAmount: 300000, maxAmount: 500000, rate: 0.0 },
        { minAmount: 500000, maxAmount: 1000000, rate: 0.0 },
        { minAmount: 1000000, maxAmount: 3000000, rate: 0.0 },
        { minAmount: 3000000, maxAmount: 5000000, rate: 0.0 },
        { minAmount: 5000000, maxAmount: 10000000, rate: 0.0 },
        { minAmount: 10000000, maxAmount: Infinity, rate: 0.0 },
      ],
    },
    monex: {
      company: 'マネックス証券',
      minFee: 0,
      maxFee: 0,
      rates: [
        { minAmount: 0, maxAmount: 100000, rate: 0.0 },
        { minAmount: 100000, maxAmount: 300000, rate: 0.0 },
        { minAmount: 300000, maxAmount: 500000, rate: 0.0 },
        { minAmount: 500000, maxAmount: 1000000, rate: 0.0 },
        { minAmount: 1000000, maxAmount: 3000000, rate: 0.0 },
        { minAmount: 3000000, maxAmount: 5000000, rate: 0.0 },
        { minAmount: 5000000, maxAmount: 10000000, rate: 0.0 },
        { minAmount: 10000000, maxAmount: Infinity, rate: 0.0 },
      ],
    },
    // 従来の手数料体系（参考用）
    traditional: {
      company: '従来型証券会社',
      minFee: 100,
      maxFee: 100000,
      rates: [
        { minAmount: 0, maxAmount: 100000, rate: 0.001 },
        { minAmount: 100000, maxAmount: 300000, rate: 0.0008 },
        { minAmount: 300000, maxAmount: 500000, rate: 0.0006 },
        { minAmount: 500000, maxAmount: 1000000, rate: 0.0004 },
        { minAmount: 1000000, maxAmount: 3000000, rate: 0.0003 },
        { minAmount: 3000000, maxAmount: 5000000, rate: 0.0002 },
        { minAmount: 5000000, maxAmount: 10000000, rate: 0.0001 },
        { minAmount: 10000000, maxAmount: Infinity, rate: 0.00005 },
      ],
    },
  };

  /**
   * 取引手数料を計算
   * @param amount 取引金額
   * @param company 証券会社
   * @returns 手数料計算結果
   */
  static calculateCommission(
    amount: number,
    company: string = 'sbi'
  ): FeeCalculationResult {
    const feeStructure = this.FEE_STRUCTURES[company] || this.FEE_STRUCTURES.sbi;
    
    // 手数料計算
    let baseCommission = 0;
    
    for (const rate of feeStructure.rates) {
      if (amount >= rate.minAmount && amount < rate.maxAmount) {
        baseCommission = amount * rate.rate;
        break;
      }
    }
    
    // 最小・最大手数料の適用
    baseCommission = Math.max(baseCommission, feeStructure.minFee);
    baseCommission = Math.min(baseCommission, feeStructure.maxFee);
    
    // 消費税計算（8%）
    const tax = Math.floor(baseCommission * 0.08);
    
    // 合計手数料
    const total = baseCommission + tax;
    
    return {
      commission: baseCommission,
      tax: tax,
      total: total,
      breakdown: {
        baseCommission: baseCommission,
        tax: tax,
        total: total,
      },
    };
  }

  /**
   * 売買両方の手数料を計算
   * @param buyAmount 買い注文金額
   * @param sellAmount 売り注文金額
   * @param company 証券会社
   * @returns 合計手数料
   */
  static calculateTotalCommission(
    buyAmount: number,
    sellAmount: number,
    company: string = 'sbi'
  ): number {
    const buyFee = this.calculateCommission(buyAmount, company);
    const sellFee = this.calculateCommission(sellAmount, company);
    
    return buyFee.total + sellFee.total;
  }

  /**
   * 利益計算（手数料込み）
   * @param buyAmount 買い注文金額
   * @param sellAmount 売り注文金額
   * @param company 証券会社
   * @returns 純利益
   */
  static calculateNetProfit(
    buyAmount: number,
    sellAmount: number,
    company: string = 'sbi'
  ): number {
    const totalCommission = this.calculateTotalCommission(buyAmount, sellAmount, company);
    return sellAmount - buyAmount - totalCommission;
  }

  /**
   * 利益率計算（手数料込み）
   * @param buyAmount 買い注文金額
   * @param sellAmount 売り注文金額
   * @param company 証券会社
   * @returns 利益率（%）
   */
  static calculateProfitRate(
    buyAmount: number,
    sellAmount: number,
    company: string = 'sbi'
  ): number {
    const netProfit = this.calculateNetProfit(buyAmount, sellAmount, company);
    return (netProfit / buyAmount) * 100;
  }

  /**
   * 利用可能な証券会社一覧を取得
   * @returns 証券会社一覧
   */
  static getAvailableCompanies(): string[] {
    return Object.keys(this.FEE_STRUCTURES);
  }

  /**
   * 証券会社の手数料体系を取得
   * @param company 証券会社
   * @returns 手数料体系
   */
  static getFeeStructure(company: string): FeeStructure | null {
    return this.FEE_STRUCTURES[company] || null;
  }
}
