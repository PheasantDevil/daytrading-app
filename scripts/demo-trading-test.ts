import { prisma } from './src/core/database';
import { simplePredictor } from './src/ml/simple-predictor';
import { demoTradingService } from './src/services/demo-trading';

interface TradingResult {
  symbol: string;
  name: string;
  initialPrice: number;
  predictedPrice: number;
  actualPrice: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  pnl: number;
  pnlPercent: number;
  confidence: number;
  timestamp: Date;
}

class DemoTradingTest {
  private results: TradingResult[] = [];
  private initialBalance = 1000000; // 100万円

  async runTradingTest(): Promise<void> {
    console.log('🚀 デモトレードテストを開始します...');
    console.log(`💰 初期資金: ${this.initialBalance.toLocaleString()}円`);
    console.log('');

    // デモ環境をリセット
    demoTradingService.reset();

    // 利用可能な銘柄を取得
    const stocks = await prisma.stock.findMany({
      take: 5, // 5銘柄でテスト
      orderBy: { id: 'asc' },
    });

    console.log(`📊 テスト対象銘柄: ${stocks.length}銘柄`);
    stocks.forEach((stock) => {
      console.log(`  - ${stock.symbol}: ${stock.name}`);
    });
    console.log('');

    // 各銘柄で取引を実行
    for (const stock of stocks) {
      await this.tradeStock(stock.id, stock.symbol, stock.name);
    }

    // 結果を分析
    await this.analyzeResults();
  }

  private async tradeStock(
    stockId: number,
    symbol: string,
    name: string
  ): Promise<void> {
    console.log(`\n📈 ${symbol} (${name}) の取引を開始...`);

    try {
      // 現在価格を取得
      const currentPrices = await prisma.stockPrice.findMany({
        where: { stockId },
        orderBy: { timestamp: 'desc' },
        take: 1,
      });

      if (currentPrices.length === 0) {
        console.log(`❌ ${symbol}: 価格データが見つかりません`);
        return;
      }

      const currentPrice = currentPrices[0].price;
      console.log(`  💰 現在価格: ${currentPrice.toLocaleString()}円`);

      // 予測を実行
      const predictions = await simplePredictor.predict(stockId);
      const prediction = predictions[0];
      console.log(
        `  🔮 予測価格: ${prediction.predictedPrice.toLocaleString()}円 (信頼度: ${(prediction.confidence * 100).toFixed(1)}%)`
      );

      // 取引戦略を決定
      const priceDiff = prediction.predictedPrice - currentPrice;
      const priceDiffPercent = (priceDiff / currentPrice) * 100;

      let side: 'BUY' | 'SELL' | null = null;
      let quantity = 0;

      // 予測価格が現在価格より2%以上高い場合は買い
      if (priceDiffPercent > 2 && prediction.confidence > 0.4) {
        side = 'BUY';
        quantity = Math.floor(50000 / currentPrice); // 5万円分購入
      }
      // 予測価格が現在価格より2%以上低い場合は売り（ポジションがある場合）
      else if (priceDiffPercent < -2 && prediction.confidence > 0.4) {
        side = 'SELL';
        const position = demoTradingService
          .getPositions()
          .find((p) => p.symbol === symbol);
        if (position && position.quantity > 0) {
          quantity = Math.min(
            position.quantity,
            Math.floor(100000 / currentPrice)
          );
        } else {
          side = null; // ポジションがない場合は売れない
        }
      }

      if (side && quantity > 0) {
        console.log(
          `  📝 取引決定: ${side} ${quantity}株 @ ${currentPrice.toLocaleString()}円`
        );

        // 注文を発注
        const order = await demoTradingService.placeOrder(
          symbol,
          side,
          quantity,
          currentPrice
        );
        console.log(`  ✅ 注文ID: ${order.id}`);

        // 少し待機して約定を待つ
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // 結果を記録
        const finalPrice = currentPrice; // デモ環境では価格変動なし
        const pnl = side === 'BUY' ? 0 : (finalPrice - currentPrice) * quantity; // 買いの場合は未実現損益
        const pnlPercent =
          side === 'BUY' ? 0 : (pnl / (currentPrice * quantity)) * 100;

        this.results.push({
          symbol,
          name,
          initialPrice: currentPrice,
          predictedPrice: prediction.predictedPrice,
          actualPrice: finalPrice,
          quantity,
          side,
          pnl,
          pnlPercent,
          confidence: prediction.confidence,
          timestamp: new Date(),
        });

        console.log(
          `  📊 結果: PnL ${pnl.toLocaleString()}円 (${pnlPercent.toFixed(2)}%)`
        );
      } else {
        console.log(`  ⏸️  取引条件を満たさないためスキップ`);
      }
    } catch (error) {
      console.error(`❌ ${symbol} の取引でエラー:`, error);
    }
  }

  private async analyzeResults(): Promise<void> {
    console.log('\n📊 === 取引結果分析 ===');

    const totalTrades = this.results.length;
    const buyTrades = this.results.filter((r) => r.side === 'BUY').length;
    const sellTrades = this.results.filter((r) => r.side === 'SELL').length;

    const totalPnL = this.results.reduce((sum, r) => sum + r.pnl, 0);
    const avgConfidence =
      this.results.reduce((sum, r) => sum + r.confidence, 0) / totalTrades || 0;

    const currentBalance = demoTradingService.getBalance();
    const totalAssets = demoTradingService.getTotalAssets();
    const totalReturn = totalAssets - this.initialBalance;
    const totalReturnPercent = (totalReturn / this.initialBalance) * 100;

    console.log(`\n💰 資金状況:`);
    console.log(`  初期資金: ${this.initialBalance.toLocaleString()}円`);
    console.log(`  現在残高: ${currentBalance.toLocaleString()}円`);
    console.log(`  総資産: ${totalAssets.toLocaleString()}円`);
    console.log(
      `  損益: ${totalReturn.toLocaleString()}円 (${totalReturnPercent.toFixed(2)}%)`
    );

    console.log(`\n📈 取引統計:`);
    console.log(`  総取引数: ${totalTrades}回`);
    console.log(`  買い注文: ${buyTrades}回`);
    console.log(`  売り注文: ${sellTrades}回`);
    console.log(`  平均信頼度: ${(avgConfidence * 100).toFixed(1)}%`);

    console.log(`\n📋 個別取引結果:`);
    this.results.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.symbol} (${result.name})`);
      console.log(
        `     ${result.side} ${result.quantity}株 @ ${result.initialPrice.toLocaleString()}円`
      );
      console.log(
        `     予測: ${result.predictedPrice.toLocaleString()}円 (信頼度: ${(result.confidence * 100).toFixed(1)}%)`
      );
      console.log(
        `     損益: ${result.pnl.toLocaleString()}円 (${result.pnlPercent.toFixed(2)}%)`
      );
    });

    // ポジション状況
    const positions = demoTradingService.getPositions();
    if (positions.length > 0) {
      console.log(`\n💼 現在のポジション:`);
      positions.forEach((position) => {
        const unrealizedPnl =
          (position.currentPrice - position.averagePrice) * position.quantity;
        const unrealizedPnlPercent =
          position.averagePrice > 0
            ? ((position.currentPrice - position.averagePrice) /
                position.averagePrice) *
              100
            : 0;
        console.log(
          `  ${position.symbol}: ${position.quantity}株 @ ${position.averagePrice.toLocaleString()}円`
        );
        console.log(
          `    現在価格: ${position.currentPrice.toLocaleString()}円`
        );
        console.log(
          `    未実現損益: ${unrealizedPnl.toLocaleString()}円 (${unrealizedPnlPercent.toFixed(2)}%)`
        );
      });
    }

    // 結果を保存
    await this.saveResults();
  }

  private async saveResults(): Promise<void> {
    const reportData = {
      summary: {
        initialBalance: this.initialBalance,
        currentBalance: demoTradingService.getBalance(),
        totalAssets: demoTradingService.getTotalAssets(),
        totalReturn: demoTradingService.getTotalAssets() - this.initialBalance,
        totalReturnPercent:
          ((demoTradingService.getTotalAssets() - this.initialBalance) /
            this.initialBalance) *
          100,
        totalTrades: this.results.length,
        buyTrades: this.results.filter((r) => r.side === 'BUY').length,
        sellTrades: this.results.filter((r) => r.side === 'SELL').length,
        avgConfidence:
          this.results.reduce((sum, r) => sum + r.confidence, 0) /
            this.results.length || 0,
        timestamp: new Date().toISOString(),
      },
      trades: this.results,
      positions: demoTradingService.getPositions(),
      orders: demoTradingService.getOrders(),
    };

    // 結果をファイルに保存（後でMarkdownレポートとして使用）
    const fs = await import('fs');
    fs.writeFileSync(
      'trading-results.json',
      JSON.stringify(reportData, null, 2)
    );

    console.log('\n💾 結果を trading-results.json に保存しました');
  }
}

// テストを実行
async function main() {
  const test = new DemoTradingTest();
  await test.runTradingTest();
}

main().catch(console.error);
