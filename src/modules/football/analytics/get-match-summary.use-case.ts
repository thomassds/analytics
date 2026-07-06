import { Injectable } from '@nestjs/common';
import { AppError } from '../../../common/errors/app-error';
import {
  AnalyticsRepository,
  MatchActuals,
  MatchPeriod,
} from '../repositories/analytics.repository';
import { MarketMetrics, MetricService, MetricsResult } from './metric.service';

export interface TeamSummary {
  teamId: string;
  sampleSize: number; // jogos com cartões (base do denominador)
  shotSampleSize: number; // jogos com estatística de chutes
  metrics: MarketMetrics;
}

export interface RefereeSummary {
  name: string;
  sampleSize: number;
  metrics: MetricsResult;
}

export interface MatchSummary {
  match: {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    kickoffAt: Date;
  };
  home: TeamSummary;
  away: TeamSummary;
  referee: RefereeSummary | null;
  matchTotal: {
    metrics: MarketMetrics;
    bothTeamsScore: number; // P(ambos marcam)
    assumesIndependence: true;
  } | null;
  // O que REALMENTE saiu (só jogo finalizado) → previsão × resultado.
  result: MatchActuals | null;
  capturedAt: string | null; // quando a análise foi congelada (snapshot)
}

/**
 * Análise preditiva da partida: resolve os dois times e projeta pelo histórico
 * de cada um. Combina (convolução) E separa.
 */
@Injectable()
export class GetMatchSummaryUseCase {
  constructor(
    private readonly repo: AnalyticsRepository,
    private readonly metrics: MetricService,
  ) {}

  async execute(matchId: string, period?: MatchPeriod): Promise<MatchSummary> {
    const match = await this.repo.getMatchById(matchId);
    if (!match) throw new AppError('MATCH_NOT_FOUND', 404);

    // Previsão SEMPRE as-of kickoff: usa só o histórico anterior ao jogo. Assim,
    // num jogo já encerrado, a análise não "vaza" o próprio resultado/futuro —
    // o que torna honesta a comparação previsão × resultado.
    const before = match.kickoffAt;

    const homeCounts = await this.repo.getPerMatchCardCounts({
      teamId: match.homeTeamId,
      period,
      before,
    });
    const awayCounts = await this.repo.getPerMatchCardCounts({
      teamId: match.awayTeamId,
      period,
      before,
    });
    const homeStats = await this.repo.getPerMatchTeamStats({
      teamId: match.homeTeamId,
      before,
    });
    const awayStats = await this.repo.getPerMatchTeamStats({
      teamId: match.awayTeamId,
      before,
    });
    const homeGoals = await this.repo.getPerMatchGoalsFor(
      match.homeTeamId,
      period,
      before,
    );
    const awayGoals = await this.repo.getPerMatchGoalsFor(
      match.awayTeamId,
      period,
      before,
    );

    const matchTotal =
      homeCounts.length > 0 && awayCounts.length > 0
        ? {
            metrics: {
              ...this.metrics.convolve(homeCounts, awayCounts),
              ...this.metrics.convolveStats(homeStats, awayStats),
              goals: this.metrics.convolveGoals(homeGoals, awayGoals),
            } as MarketMetrics,
            bothTeamsScore: this.metrics.bothTeamsScore(homeGoals, awayGoals),
            assumesIndependence: true as const,
          }
        : null;

    let referee: RefereeSummary | null = null;
    if (match.refereeId) {
      const refCounts = await this.repo.getPerMatchCardCounts({
        refereeId: match.refereeId,
        period,
        before,
      });
      const name = await this.repo.getRefereeName(match.refereeId);
      if (name && refCounts.length > 0) {
        referee = {
          name,
          sampleSize: refCounts.length,
          metrics: this.metrics.compute(refCounts),
        };
      }
    }

    // resultado real (só finalizado) — respeita o período selecionado
    const result = await this.repo.getMatchActuals(matchId, period);
    const capturedAt = await this.repo.getSnapshotCapturedAt(matchId);

    return {
      match: {
        id: match.id,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        kickoffAt: match.kickoffAt,
      },
      home: {
        teamId: match.homeTeamId,
        sampleSize: homeCounts.length,
        shotSampleSize: homeStats.length,
        metrics: {
          ...this.metrics.compute(homeCounts),
          ...this.metrics.computeStats(homeStats),
          goals: this.metrics.computeGoals(homeGoals),
        },
      },
      away: {
        teamId: match.awayTeamId,
        sampleSize: awayCounts.length,
        shotSampleSize: awayStats.length,
        metrics: {
          ...this.metrics.compute(awayCounts),
          ...this.metrics.computeStats(awayStats),
          goals: this.metrics.computeGoals(awayGoals),
        },
      },
      referee,
      matchTotal,
      result,
      capturedAt: capturedAt ? capturedAt.toISOString() : null,
    };
  }
}
