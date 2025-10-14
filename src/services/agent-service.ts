import { prisma } from '@/core/database';
import { AgentConfig, AgentDecision } from '@/types/investment';
import { Mark1Agent } from '../agents/mark1-agent';

export class AgentService {
  private agents: Map<string, Mark1Agent> = new Map();

  /**
   * エージェントを初期化
   */
  async initializeAgent(agentId: string): Promise<Mark1Agent> {
    if (this.agents.has(agentId)) {
      return this.agents.get(agentId)!;
    }

    const agent = new Mark1Agent(agentId);
    await agent.initialize();
    this.agents.set(agentId, agent);
    return agent;
  }

  /**
   * Mark1エージェントを作成
   */
  async createMark1Agent(config: {
    name: string;
    minConfidence?: number;
    maxPositionSize?: number;
    stopLossPercent?: number;
    takeProfitPercent?: number;
    maxDailyTrades?: number;
    riskTolerance?: 'LOW' | 'MEDIUM' | 'HIGH';
  }): Promise<AgentConfig> {
    const dbConfig = await prisma.agentConfig.create({
      data: {
        name: config.name,
        version: '1.0.0',
        minConfidence: config.minConfidence || 60,
        maxPositionSize: config.maxPositionSize || 100000,
        stopLossPercent: config.stopLossPercent || 5,
        takeProfitPercent: config.takeProfitPercent || 10,
        maxDailyTrades: config.maxDailyTrades || 5,
        riskTolerance: config.riskTolerance || 'MEDIUM',
      },
    });

    // Prismaの型をAgentConfig型にマッピング
    return {
      ...dbConfig,
      riskTolerance: dbConfig.riskTolerance as 'LOW' | 'MEDIUM' | 'HIGH',
    };
  }

  /**
   * エージェント設定を取得
   */
  async getAgentConfig(agentId: string): Promise<AgentConfig | null> {
    const dbConfig = await prisma.agentConfig.findUnique({
      where: { id: agentId },
    });

    if (!dbConfig) return null;

    // Prismaの型をAgentConfig型にマッピング
    return {
      ...dbConfig,
      riskTolerance: dbConfig.riskTolerance as 'LOW' | 'MEDIUM' | 'HIGH',
    };
  }

  /**
   * 全エージェント設定を取得
   */
  async getAllAgentConfigs(): Promise<AgentConfig[]> {
    const dbConfigs = await prisma.agentConfig.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Prismaの型をAgentConfig型にマッピング
    return dbConfigs.map((dbConfig) => ({
      ...dbConfig,
      riskTolerance: dbConfig.riskTolerance as 'LOW' | 'MEDIUM' | 'HIGH',
    }));
  }

  /**
   * エージェントの判断履歴を取得
   */
  async getAgentDecisions(
    agentId: string,
    limit: number = 50
  ): Promise<AgentDecision[]> {
    const decisions = await prisma.agentDecision.findMany({
      where: { agentId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Prismaの型をAgentDecision型にマッピング
    return decisions as any as AgentDecision[];
  }

  /**
   * エージェントのパフォーマンスを分析
   */
  async analyzeAgentPerformance(agentId: string): Promise<{
    totalDecisions: number;
    buyDecisions: number;
    sellDecisions: number;
    holdDecisions: number;
    averageConfidence: number;
    successRate: number;
    recentDecisions: AgentDecision[];
  }> {
    const decisions = await this.getAgentDecisions(agentId, 100);

    const totalDecisions = decisions.length;
    const buyDecisions = decisions.filter((d) => d.action === 'BUY').length;
    const sellDecisions = decisions.filter((d) => d.action === 'SELL').length;
    const holdDecisions = decisions.filter((d) => d.action === 'HOLD').length;

    const averageConfidence =
      decisions.length > 0
        ? decisions.reduce((sum, d) => sum + ((d as any).confidence || 0), 0) /
          decisions.length
        : 0;

    // 成功率の計算（簡易版）
    const executedDecisions = decisions.filter((d) => d.action !== 'HOLD');
    const successfulDecisions = executedDecisions.filter(
      (d) => d.expectedReturn > 0
    );
    const successRate =
      executedDecisions.length > 0
        ? (successfulDecisions.length / executedDecisions.length) * 100
        : 0;

    return {
      totalDecisions,
      buyDecisions,
      sellDecisions,
      holdDecisions,
      averageConfidence,
      successRate,
      recentDecisions: decisions.slice(0, 10),
    };
  }

  /**
   * エージェントの判断を記録
   */
  async recordDecision(decision: {
    agentId: string;
    productId: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    reason: string;
    technicalAnalysis: string;
    riskAnalysis: string;
    marketAnalysis: string;
    confidence: number;
    expectedReturn: number;
    stopLoss?: number;
    takeProfit?: number;
  }): Promise<AgentDecision> {
    const dbDecision = await prisma.agentDecision.create({
      data: {
        agentId: decision.agentId,
        productId: decision.productId,
        action: decision.action,
        reason: decision.reason,
        technicalAnalysis: decision.technicalAnalysis,
        riskAnalysis: decision.riskAnalysis,
        marketAnalysis: decision.marketAnalysis,
        confidence: decision.confidence,
        expectedReturn: decision.expectedReturn,
        stopLoss: decision.stopLoss,
        takeProfit: decision.takeProfit,
      },
      include: { product: true },
    });

    // Prismaの型をAgentDecision型にマッピング
    return dbDecision as any as AgentDecision;
  }

  /**
   * エージェントの判断レポートを生成
   */
  async generateDecisionReport(agentId: string): Promise<string> {
    const decisions = await this.getAgentDecisions(agentId, 20);
    const performance = await this.analyzeAgentPerformance(agentId);

    let report = `# エージェント判断レポート\n\n`;
    report += `## エージェントID: ${agentId}\n`;
    report += `## 生成日時: ${new Date().toLocaleString('ja-JP')}\n\n`;

    report += `## パフォーマンス概要\n`;
    report += `- 総判断数: ${performance.totalDecisions}回\n`;
    report += `- 買い判断: ${performance.buyDecisions}回\n`;
    report += `- 売り判断: ${performance.sellDecisions}回\n`;
    report += `- ホールド判断: ${performance.holdDecisions}回\n`;
    report += `- 平均信頼度: ${performance.averageConfidence.toFixed(1)}%\n`;
    report += `- 成功率: ${performance.successRate.toFixed(1)}%\n\n`;

    report += `## 最近の判断履歴\n\n`;

    decisions.forEach((decision, index) => {
      const d = decision as any;
      report += `### ${index + 1}. ${d.product?.name || 'N/A'} (${d.product?.symbol || 'N/A'})\n`;
      report += `- **判断**: ${d.action}\n`;
      report += `- **理由**: ${d.reason}\n`;
      report += `- **信頼度**: ${(d.confidence || 0).toFixed(1)}%\n`;
      report += `- **期待リターン**: ${(d.expectedReturn || 0).toFixed(2)}%\n`;
      report += `- **技術分析**: ${d.technicalAnalysis || 'N/A'}\n`;
      report += `- **リスク分析**: ${d.riskAnalysis || 'N/A'}\n`;
      report += `- **市場分析**: ${d.marketAnalysis || 'N/A'}\n`;
      report += `- **判断時刻**: ${new Date(d.createdAt).toLocaleString('ja-JP')}\n\n`;
    });

    return report;
  }

  /**
   * エージェントを実行（全商品を分析）
   */
  async runAgent(agentId: string): Promise<{
    analyzedProducts: number;
    executedTrades: number;
    decisions: AgentDecision[];
  }> {
    const agent = await this.initializeAgent(agentId);
    const products = await prisma.investmentProduct.findMany({
      where: { isActive: true },
    });

    let executedTrades = 0;
    const decisions: AgentDecision[] = [];

    for (const product of products) {
      try {
        // 商品を分析
        const signal = await agent.analyzeProduct(product.id);

        // 取引を実行
        const tradeExecuted = await agent.executeTrade(product.id, signal);
        if (tradeExecuted) {
          executedTrades++;
        }

        // 判断を記録
        const decision = await prisma.agentDecision.findFirst({
          where: {
            agentId,
            productId: product.id,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (decision) {
          decisions.push(decision as any);
        }
      } catch (error) {
        console.error(
          `エージェント ${agentId} で商品 ${product.symbol} の分析中にエラー:`,
          error
        );
      }
    }

    return {
      analyzedProducts: products.length,
      executedTrades,
      decisions,
    };
  }

  /**
   * エージェントの判断レポートをファイルに保存
   */
  async saveDecisionReport(agentId: string): Promise<string> {
    const report = await this.generateDecisionReport(agentId);
    const fs = await import('fs');
    const path = await import('path');

    const reportPath = path.join(
      process.cwd(),
      'result',
      `agent-${agentId}-decisions.md`
    );
    fs.writeFileSync(reportPath, report, 'utf-8');

    return reportPath;
  }
}

export const agentService = new AgentService();
