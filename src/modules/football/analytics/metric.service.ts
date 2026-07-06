import { Injectable } from '@nestjs/common';
import {
  PerMatchCardCounts,
  PerMatchTeamStats,
} from '../repositories/analytics.repository';
import {
  CdfPoint,
  Distribution,
  DistributionService,
} from './distribution.service';

export type CardMetric =
  | 'totalCards'
  | 'yellowCards'
  | 'redCards'
  | 'weighted';

export type StatMetric =
  | 'shots'
  | 'shotsOnGoal'
  | 'corners'
  | 'fouls'
  | 'offsides'
  | 'saves';

export type GoalMetric = 'goals';

export type Market = CardMetric | StatMetric | GoalMetric;

export type MetricsResult = Record<CardMetric, Distribution>;
export type StatMetricsResult = Record<StatMetric, Distribution>;
/** Todos os mercados de uma partida (cartões + chutes + escanteios) num objeto. */
export type MarketMetrics = Record<Market, Distribution>;

/**
 * Aplica a REGRA DE NEGÓCIO de cada métrica sobre a base fiel e delega a
 * estatística à DistributionService. A ponderação (red=2) vive AQUI, não no banco.
 */
@Injectable()
export class MetricService {
  constructor(private readonly distribution: DistributionService) {}

  compute(counts: PerMatchCardCounts[]): MetricsResult {
    const total = counts.map((c) => c.yellow + c.red + c.second);
    const yellow = counts.map((c) => c.yellow + c.second);
    const red = counts.map((c) => c.red + c.second);
    // base ponderada: amarelo(1) + 2º amarelo(1) + vermelho direto(2)
    const weighted = counts.map((c) => c.yellow + c.second + c.red * 2);

    return {
      totalCards: this.distribution.compute(total),
      yellowCards: this.distribution.compute(yellow),
      redCards: this.distribution.compute(red),
      weighted: this.distribution.compute(weighted),
    };
  }

  /** Distribuições de chutes, chutes ao gol e escanteios do time. Cada métrica
   *  usa só os jogos em que aquele dado existe (null é descartado). */
  computeStats(counts: PerMatchTeamStats[]): StatMetricsResult {
    const col = (pick: (c: PerMatchTeamStats) => number | null): number[] =>
      counts.map(pick).filter((v): v is number => v != null);
    return {
      shots: this.distribution.compute(col((c) => c.shots)),
      shotsOnGoal: this.distribution.compute(col((c) => c.onGoal)),
      corners: this.distribution.compute(col((c) => c.corners)),
      fouls: this.distribution.compute(col((c) => c.fouls)),
      offsides: this.distribution.compute(col((c) => c.offsides)),
      saves: this.distribution.compute(col((c) => c.saves)),
    };
  }

  /** Convolução empírica de duas distribuições `perGame` (assume independência). */
  convolve(a: PerMatchCardCounts[], b: PerMatchCardCounts[]): MetricsResult {
    const ma = this.compute(a);
    const mb = this.compute(b);
    const metrics: CardMetric[] = [
      'totalCards',
      'yellowCards',
      'redCards',
      'weighted',
    ];
    const out = {} as MetricsResult;
    for (const m of metrics) {
      out[m] = this.convolveDist(ma[m], mb[m]);
    }
    return out;
  }

  /** Distribuição de gols marcados pelo time por jogo. */
  computeGoals(goalsPerMatch: number[]): Distribution {
    return this.distribution.compute(goalsPerMatch);
  }

  /** Total de gols da partida = convolução dos gols dos dois times (independência). */
  convolveGoals(home: number[], away: number[]): Distribution {
    return this.convolveDist(
      this.distribution.compute(home),
      this.distribution.compute(away),
    );
  }

  /** P(ambos marcam) = P(mandante ≥1) × P(visitante ≥1), assumindo independência. */
  bothTeamsScore(home: number[], away: number[]): number {
    const pScore = (arr: number[]): number => {
      if (arr.length === 0) return 0;
      const zero = arr.filter((g) => g === 0).length / arr.length;
      return 1 - zero;
    };
    return Math.round(pScore(home) * pScore(away) * 1000) / 1000;
  }

  /** Convolução das estatísticas dos dois times (total da partida). */
  convolveStats(
    a: PerMatchTeamStats[],
    b: PerMatchTeamStats[],
  ): StatMetricsResult {
    const ma = this.computeStats(a);
    const mb = this.computeStats(b);
    return {
      shots: this.convolveDist(ma.shots, mb.shots),
      shotsOnGoal: this.convolveDist(ma.shotsOnGoal, mb.shotsOnGoal),
      corners: this.convolveDist(ma.corners, mb.corners),
      fouls: this.convolveDist(ma.fouls, mb.fouls),
      offsides: this.convolveDist(ma.offsides, mb.offsides),
      saves: this.convolveDist(ma.saves, mb.saves),
    };
  }

  private convolveDist(
    a: Distribution,
    b: Distribution,
  ): Distribution {
    // P(total = s) = Σ P(A=i)·P(B=j), i+j=s. Reconstrói uma amostra ponderada.
    const pa = this.toProb(a);
    const pb = this.toProb(b);
    const combined: Record<number, number> = {};
    for (const [i, piRaw] of Object.entries(pa)) {
      for (const [j, pjRaw] of Object.entries(pb)) {
        const s = Number(i) + Number(j);
        combined[s] = (combined[s] ?? 0) + piRaw * pjRaw;
      }
    }

    // Recomputa mean e cdf a partir da distribuição de probabilidade combinada.
    const values = Object.keys(combined).map(Number);
    const max = values.length ? Math.max(...values) : 0;
    let mean = 0;
    for (const [s, p] of Object.entries(combined)) mean += Number(s) * p;

    const cdf: CdfPoint[] = [];
    for (let k = 1; k <= max + 1; k++) {
      let pUnder = 0;
      for (const [s, p] of Object.entries(combined)) {
        if (Number(s) < k) pUnder += p;
      }
      cdf.push({
        value: k,
        pUnder: this.round(pUnder),
        // combinação de amostras: n efetivo é o menor dos dois (mais conservador)
        wilsonLow: this.round(Math.max(0, pUnder - this.margin(pUnder, a, b))),
        wilsonHigh: this.round(Math.min(1, pUnder + this.margin(pUnder, a, b))),
      });
    }

    return {
      sampleSize: Math.min(a.sampleSize, b.sampleSize),
      perGame: this.round01Map(combined),
      mean: this.round(mean),
      cdf,
    };
  }

  private toProb(d: Distribution): Record<number, number> {
    const out: Record<number, number> = {};
    if (d.sampleSize === 0) return out;
    for (const [k, freq] of Object.entries(d.perGame)) {
      out[Number(k)] = freq / d.sampleSize;
    }
    return out;
  }

  private margin(p: number, a: Distribution, b: Distribution): number {
    const n = Math.min(a.sampleSize, b.sampleSize);
    if (n === 0) return 0;
    return 1.96 * Math.sqrt((p * (1 - p)) / n);
  }

  private round(v: number): number {
    return Math.round(v * 1000) / 1000;
  }

  private round01Map(m: Record<number, number>): Record<number, number> {
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(m)) out[Number(k)] = this.round(v);
    return out;
  }
}
