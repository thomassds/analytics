import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { AppError } from '../../../common/errors/app-error';
import { isUuid } from '../../../common/utils/uuid';
import { GetHistoryUseCase } from './get-history.use-case';
import { GetMatchSummaryUseCase } from './get-match-summary.use-case';
import { GetOpportunitiesUseCase } from './get-opportunities.use-case';
import { ValueService } from './value.service';
import { CardMetric } from './metric.service';
import { AnalyticsFilter } from '../repositories/analytics.repository';

const METRICS: CardMetric[] = [
  'totalCards',
  'yellowCards',
  'redCards',
  'weighted',
];

/** Análise de dados PÚBLICOS de futebol — leitura sem login (como o catálogo). */
@Public()
@ApiTags('Analytics')
@Controller()
export class AnalyticsController {
  constructor(
    private readonly getHistory: GetHistoryUseCase,
    private readonly getMatchSummary: GetMatchSummaryUseCase,
    private readonly getOpportunities: GetOpportunitiesUseCase,
    private readonly value: ValueService,
  ) {}

  @Get('opportunities')
  @ApiOperation({ summary: 'Feed de oportunidades (ponto doce, sobre os snapshots)' })
  async opportunities(@Query('limit') limit?: string) {
    const n = Math.min(Math.max(Number(limit) || 40, 1), 100);
    const data = await this.getOpportunities.execute(n);
    return { success: true, data };
  }

  @Get('analytics/history')
  @ApiOperation({ summary: 'Histórico descritivo (filtro flexível)' })
  async history(
    @Query('teamId') teamId?: string,
    @Query('playerId') playerId?: string,
    @Query('refereeId') refereeId?: string,
    @Query('competitionId') competitionId?: string,
    @Query('metric') metric?: string,
    @Query('threshold') threshold?: string,
    @Query('odd') odd?: string,
  ) {
    const filter = this.buildFilter({
      teamId,
      playerId,
      refereeId,
      competitionId,
    });
    const data = await this.getHistory.execute(filter);

    const value = this.maybeValue(
      data.metrics,
      metric,
      threshold,
      odd,
    );
    return { success: true, data: { ...data, value } };
  }

  @Get('matches/:matchId/opportunities')
  @ApiOperation({ summary: 'Oportunidades (ponto doce) desta partida' })
  async matchOpportunities(@Param('matchId') matchId: string) {
    if (!isUuid(matchId)) throw new AppError('VALIDATION_ERROR', 422);
    const data = await this.getOpportunities.executeForMatch(matchId);
    return { success: true, data };
  }

  @Get('matches/:matchId/summary')
  @ApiOperation({ summary: 'Análise preditiva da partida (combina e separa)' })
  async summary(
    @Param('matchId') matchId: string,
    @Query('period') period?: string,
  ) {
    if (!isUuid(matchId)) throw new AppError('VALIDATION_ERROR', 422);
    if (period !== undefined && period !== 'first' && period !== 'second') {
      throw new AppError('INVALID_FILTER', 422);
    }
    const data = await this.getMatchSummary.execute(
      matchId,
      period as 'first' | 'second' | undefined,
    );
    return { success: true, data };
  }

  private buildFilter(f: AnalyticsFilter): AnalyticsFilter {
    const out: AnalyticsFilter = {};
    for (const key of [
      'teamId',
      'playerId',
      'refereeId',
      'competitionId',
    ] as const) {
      const v = f[key];
      if (v !== undefined) {
        if (!isUuid(v)) throw new AppError('INVALID_FILTER', 422);
        out[key] = v;
      }
    }
    return out;
  }

  private maybeValue(
    metrics: Record<CardMetric, { cdf: any[] }>,
    metric?: string,
    threshold?: string,
    odd?: string,
  ) {
    if (threshold === undefined || odd === undefined) return null;
    const m = (metric ?? 'totalCards') as CardMetric;
    if (!METRICS.includes(m)) throw new AppError('VALIDATION_ERROR', 422);
    const t = Number(threshold);
    const o = Number(odd);
    if (!Number.isFinite(t) || !Number.isFinite(o)) {
      throw new AppError('VALIDATION_ERROR', 422);
    }
    return this.value.compute(metrics[m].cdf as any, t, o);
  }
}
