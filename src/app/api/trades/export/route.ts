import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dateFrom, dateTo, symbol, strategy, profitMin, profitMax } = body;

    // CSVヘッダー
    const headers = [
      '日時',
      '銘柄コード',
      '銘柄名',
      '売買',
      '数量',
      '価格',
      '損益',
      '戦略',
    ];

    // モックデータ（実際の実装ではデータベースから取得）
    const mockData = [
      [
        '2024-01-10 14:32:15',
        '7203.T',
        'トヨタ自動車',
        '売却',
        '100',
        '2525',
        '2500',
        'モメンタム',
      ],
      [
        '2024-01-10 13:45:22',
        '6758.T',
        'ソニーグループ',
        '購入',
        '50',
        '12400',
        '-1200',
        '平均回帰',
      ],
      [
        '2024-01-10 11:20:33',
        '9984.T',
        'ソフトバンクグループ',
        '売却',
        '200',
        '1850',
        '3200',
        'ブレイクアウト',
      ],
      [
        '2024-01-09 15:15:45',
        '7203.T',
        'トヨタ自動車',
        '購入',
        '100',
        '2500',
        '0',
        'モメンタム',
      ],
      [
        '2024-01-09 10:30:12',
        '6758.T',
        'ソニーグループ',
        '売却',
        '50',
        '12376',
        '-1200',
        '平均回帰',
      ],
    ];

    // CSVデータを生成
    const csvContent = [
      headers.join(','),
      ...mockData.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    // CSVファイルとして返す
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="trades-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Failed to export CSV:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export CSV' },
      { status: 500 }
    );
  }
}
