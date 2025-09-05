'use client';

import { ChartData } from '@/types';
import { useEffect, useRef } from 'react';

interface StockChartProps {
  data: ChartData[];
  symbol: string;
  height?: number;
}

export default function StockChart({
  data,
  symbol,
  height = 400,
}: StockChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !data.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // キャンバスのサイズ設定
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = height * 2;
    ctx.scale(2, 2);

    // チャートの描画
    const drawChart = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, height);

      if (data.length === 0) return;

      // データの範囲を計算
      const prices = data.map((d) => d.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceRange = maxPrice - minPrice;

      // チャートの描画領域
      const padding = 40;
      const chartWidth = canvas.offsetWidth - padding * 2;
      const chartHeight = height - padding * 2;

      // 価格の正規化
      const normalizedData = data.map((d, index) => ({
        x: padding + (index / (data.length - 1)) * chartWidth,
        y: padding + ((maxPrice - d.price) / priceRange) * chartHeight,
        price: d.price,
        timestamp: d.timestamp,
      }));

      // 線の描画
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      normalizedData.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();

      // データポイントの描画
      ctx.fillStyle = '#3b82f6';
      normalizedData.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
        ctx.fill();
      });

      // グリッド線の描画
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;

      // 横線（価格）
      for (let i = 0; i <= 5; i++) {
        const y = padding + (i / 5) * chartHeight;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + chartWidth, y);
        ctx.stroke();
      }

      // 縦線（時間）
      for (let i = 0; i <= 5; i++) {
        const x = padding + (i / 5) * chartWidth;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, padding + chartHeight);
        ctx.stroke();
      }

      // 価格ラベルの描画
      ctx.fillStyle = '#374151';
      ctx.font = '12px Arial';
      ctx.textAlign = 'right';
      for (let i = 0; i <= 5; i++) {
        const price = maxPrice - (i / 5) * priceRange;
        const y = padding + (i / 5) * chartHeight;
        ctx.fillText(price.toFixed(2), padding - 10, y + 4);
      }

      // タイトル
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${symbol} Stock Price`, canvas.offsetWidth / 2, 25);
    };

    drawChart();
  }, [data, symbol, height]);

  return (
    <div className="w-full">
      <canvas
        ref={canvasRef}
        className="w-full border rounded-lg"
        style={{ height: `${height}px` }}
      />
    </div>
  );
}
