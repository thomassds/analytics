import { Injectable } from '@nestjs/common';

export interface CdfPoint {
  value: number;
  pUnder: number;
  wilsonLow: number;
  wilsonHigh: number;
}

export interface Distribution {
  sampleSize: number;
  perGame: Record<number, number>;
  mean: number;
  cdf: CdfPoint[];
}

const Z = 1.96; // 95%

/**
 * Engine estatística ÚNICA e reutilizável: série de contagens por jogo →
 * distribuição empírica + CDF + intervalo de Wilson. Não conhece "cartão".
 */
@Injectable()
export class DistributionService {
  compute(countsPerGame: number[]): Distribution {
    const sampleSize = countsPerGame.length;
    const perGame: Record<number, number> = {};
    let sum = 0;
    let max = 0;

    for (const c of countsPerGame) {
      perGame[c] = (perGame[c] ?? 0) + 1;
      sum += c;
      if (c > max) max = c;
    }

    const mean = sampleSize > 0 ? sum / sampleSize : 0;

    const cdf: CdfPoint[] = [];
    for (let k = 1; k <= max + 1; k++) {
      const under = countsPerGame.filter((c) => c < k).length;
      const pUnder = sampleSize > 0 ? under / sampleSize : 0;
      const [low, high] = this.wilson(under, sampleSize);
      cdf.push({
        value: k,
        pUnder: this.round(pUnder),
        wilsonLow: this.round(low),
        wilsonHigh: this.round(high),
      });
    }

    return { sampleSize, perGame, mean: this.round(mean), cdf };
  }

  /** Intervalo de Wilson (95%) para a proporção x/n. */
  private wilson(x: number, n: number): [number, number] {
    if (n === 0) return [0, 0];
    const p = x / n;
    const z2 = Z * Z;
    const denom = 1 + z2 / n;
    const center = (p + z2 / (2 * n)) / denom;
    const margin =
      (Z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
    return [Math.max(0, center - margin), Math.min(1, center + margin)];
  }

  private round(v: number): number {
    return Math.round(v * 1000) / 1000;
  }
}
