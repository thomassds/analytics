import { Injectable } from '@nestjs/common';
import {
  AnalyticsFilter,
  AnalyticsRepository,
} from '../repositories/analytics.repository';
import { MetricService, MetricsResult } from './metric.service';

export interface HistorySummary {
  filter: AnalyticsFilter;
  sampleSize: number;
  metrics: MetricsResult;
}

/** Análise descritiva do histórico para um filtro flexível. */
@Injectable()
export class GetHistoryUseCase {
  constructor(
    private readonly repo: AnalyticsRepository,
    private readonly metrics: MetricService,
  ) {}

  async execute(filter: AnalyticsFilter): Promise<HistorySummary> {
    const counts = await this.repo.getPerMatchCardCounts(filter);
    const metrics = this.metrics.compute(counts);
    return { filter, sampleSize: counts.length, metrics };
  }
}
