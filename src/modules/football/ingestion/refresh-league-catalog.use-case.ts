import { Inject, Injectable, Logger } from '@nestjs/common';
import { LeagueCatalogRepository } from '../repositories/league-catalog.repository';
import {
  IMatchStatsProvider,
  MATCH_STATS_PROVIDER,
} from './provider/match-stats-provider';

// Ligas famosas habilitadas por padrão (o resto entra depois, manualmente).
const FAMOUS_NATIONAL = [
  '1', // World Cup
  '9', // Copa America
  '4', // Euro
  '6', // Africa Cup of Nations
  '5', // UEFA Nations League
  '32', // WC Qual Europe
  '34', // WC Qual South America
  '29', // WC Qual Africa
  '30', // WC Qual Asia
  '31', // WC Qual CONCACAF
];
const FAMOUS_CLUB = [
  '39', // Premier League
  '140', // La Liga
  '135', // Serie A
  '78', // Bundesliga
  '61', // Ligue 1
  '71', // Brasileirão Série A
  '2', // UEFA Champions League
  '3', // UEFA Europa League
  '13', // Copa Libertadores
  '94', // Primeira Liga (Portugal)
  '88', // Eredivisie
];

@Injectable()
export class RefreshLeagueCatalogUseCase {
  private readonly logger = new Logger(RefreshLeagueCatalogUseCase.name);

  constructor(
    @Inject(MATCH_STATS_PROVIDER)
    private readonly provider: IMatchStatsProvider,
    private readonly repo: LeagueCatalogRepository,
  ) {}

  async execute(): Promise<{ leagues: number; seasons: number }> {
    const leagues = await this.provider.fetchLeagues();
    let leaguesStored = 0;
    let seasonsStored = 0;

    for (const l of leagues) {
      const covered = l.seasons.filter((s) => s.hasEvents);
      if (covered.length === 0) continue; // só ligas com cobertura de eventos

      const leagueId = await this.repo.upsertLeague({
        externalRef: l.externalRef,
        name: l.name,
        type: l.type,
        country: l.country,
      });
      leaguesStored += 1;

      for (const s of covered) {
        await this.repo.upsertCompetitionSeason({
          externalRef: `${l.externalRef}-${s.year}`,
          name: l.name,
          season: String(s.year),
          leagueId,
          hasEvents: s.hasEvents,
          hasStatistics: s.hasStatistics,
          hasLineups: s.hasLineups,
          isCurrent: s.current,
        });
        seasonsStored += 1;
      }
    }

    await this.repo.enableFamous(FAMOUS_NATIONAL, FAMOUS_CLUB);

    this.logger.log(
      `Catálogo atualizado: ${leaguesStored} ligas, ${seasonsStored} temporadas cobertas.`,
    );
    return { leagues: leaguesStored, seasons: seasonsStored };
  }
}
