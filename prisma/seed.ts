import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 サンプルデータを作成中...');

  // サンプル株価データを作成
  const stocks = [
    {
      symbol: '7203',
      name: 'トヨタ自動車',
      market: 'TSE',
      sector: '自動車',
    },
    {
      symbol: '6758',
      name: 'ソニーグループ',
      market: 'TSE',
      sector: 'エレクトロニクス',
    },
    {
      symbol: '9984',
      name: 'ソフトバンクグループ',
      market: 'TSE',
      sector: '通信',
    },
    {
      symbol: '9432',
      name: '日本電信電話',
      market: 'TSE',
      sector: '通信',
    },
    {
      symbol: '8306',
      name: '三菱UFJフィナンシャル・グループ',
      market: 'TSE',
      sector: '金融',
    },
    {
      symbol: '7974',
      name: '任天堂',
      market: 'TSE',
      sector: 'エンターテインメント',
    },
    {
      symbol: '4063',
      name: '信越化学工業',
      market: 'TSE',
      sector: '化学',
    },
    {
      symbol: '6861',
      name: 'キーエンス',
      market: 'TSE',
      sector: 'エレクトロニクス',
    },
    {
      symbol: '9983',
      name: 'ファーストリテイリング',
      market: 'TSE',
      sector: '小売',
    },
    {
      symbol: '8035',
      name: '東京エレクトロン',
      market: 'TSE',
      sector: 'エレクトロニクス',
    },
  ];

  // 株価データを挿入
  for (const stockData of stocks) {
    const stock = await prisma.stock.upsert({
      where: { symbol: stockData.symbol },
      update: stockData,
      create: stockData,
    });

    // サンプル株価データを作成（過去100日分）
    const today = new Date();
    for (let i = 0; i < 100; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      // ランダムな価格を生成（現実的な範囲で）
      const basePrice = 1000 + Math.random() * 5000;
      const price = basePrice + (Math.random() - 0.5) * 200;
      const volume = Math.floor(Math.random() * 1000000) + 100000;
      const high = price + Math.random() * 100;
      const low = price - Math.random() * 100;
      const open = price + (Math.random() - 0.5) * 50;
      const close = price;

      await prisma.stockPrice.upsert({
        where: {
          stockId_timestamp: {
            stockId: stock.id,
            timestamp: date,
          },
        },
        update: {
          price,
          volume,
          high,
          low,
          open,
          close,
        },
        create: {
          stockId: stock.id,
          price,
          volume,
          high,
          low,
          open,
          close,
          timestamp: date,
        },
      });
    }

    console.log(`✅ ${stock.name} (${stock.symbol}) のデータを作成しました`);
  }

  console.log('🎉 サンプルデータの作成が完了しました！');
}

main()
  .catch((e) => {
    console.error('❌ エラーが発生しました:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
