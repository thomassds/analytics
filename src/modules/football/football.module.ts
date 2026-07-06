import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Competition } from './entities/competition.entity';
import { League } from './entities/league.entity';
import { Team } from './entities/team.entity';
import { Player } from './entities/player.entity';
import { Referee } from './entities/referee.entity';
import { EventType } from './entities/event-type.entity';
import { Match } from './entities/match.entity';
import { MatchEvent } from './entities/match-event.entity';
import { MatchStats } from './entities/match-stats.entity';
import { RawProviderPayload } from './entities/raw-provider-payload.entity';
import { RawProviderPayloadRepository } from './repositories/raw-provider-payload.repository';
import { IngestionRepository } from './repositories/ingestion.repository';
import { AnalyticsRepository } from './repositories/analytics.repository';
import { CatalogRepository } from './repositories/catalog.repository';
import { LeagueCatalogRepository } from './repositories/league-catalog.repository';
import { ApiFootballProvider } from './ingestion/provider/api-football.provider';
import { MATCH_STATS_PROVIDER } from './ingestion/provider/match-stats-provider';
import { SyncFootballDataUseCase } from './ingestion/sync-football-data.use-case';
import { RefreshLeagueCatalogUseCase } from './ingestion/refresh-league-catalog.use-case';
import { IngestEnabledLeaguesUseCase } from './ingestion/ingest-enabled-leagues.use-case';
import { PollLiveMatchUseCase } from './ingestion/poll-live-match.use-case';
import { FootballSyncCron } from './ingestion/football-sync.cron';
import { LiveCron } from './ingestion/live.cron';
import { DistributionService } from './analytics/distribution.service';
import { MetricService } from './analytics/metric.service';
import { ValueService } from './analytics/value.service';
import { GetHistoryUseCase } from './analytics/get-history.use-case';
import { GetMatchSummaryUseCase } from './analytics/get-match-summary.use-case';
import { OpponentModelService } from './analytics/opponent-model.service';
import { GetOpportunitiesUseCase } from './analytics/get-opportunities.use-case';
import { SnapshotAnalysisUseCase } from './analytics/snapshot-analysis.use-case';
import { GetMatchDetailUseCase } from './analytics/get-match-detail.use-case';
import { AnalyticsController } from './analytics/analytics.controller';
import { CatalogController } from './analytics/catalog.controller';
import { ImageProxyController } from './analytics/image-proxy.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Competition,
      League,
      Team,
      Player,
      Referee,
      EventType,
      Match,
      MatchEvent,
      MatchStats,
      RawProviderPayload,
    ]),
  ],
  controllers: [AnalyticsController, CatalogController, ImageProxyController],
  providers: [
    RawProviderPayloadRepository,
    IngestionRepository,
    AnalyticsRepository,
    CatalogRepository,
    LeagueCatalogRepository,
    ApiFootballProvider,
    { provide: MATCH_STATS_PROVIDER, useClass: ApiFootballProvider },
    SyncFootballDataUseCase,
    RefreshLeagueCatalogUseCase,
    IngestEnabledLeaguesUseCase,
    PollLiveMatchUseCase,
    FootballSyncCron,
    LiveCron,
    DistributionService,
    MetricService,
    OpponentModelService,
    ValueService,
    GetHistoryUseCase,
    GetMatchSummaryUseCase,
    GetOpportunitiesUseCase,
    SnapshotAnalysisUseCase,
    GetMatchDetailUseCase,
  ],
  exports: [SyncFootballDataUseCase],
})
export class FootballModule {}
