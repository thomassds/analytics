/**
 * Contrato do provedor de estatísticas (Anti-Corruption Layer).
 * O domínio depende só desta interface — nunca do formato do provedor.
 * Ver specs/football-analytics/01-data-ingestion-acl.md.
 */

export const MATCH_STATS_PROVIDER = Symbol('MATCH_STATS_PROVIDER');

export type ProviderEventCode =
  | 'YELLOW_CARD'
  | 'RED_CARD'
  | 'SECOND_YELLOW'
  | 'APPEARANCE'
  | 'GOAL';

export interface ProviderTeamRef {
  externalRef: string;
  name: string;
  country: string | null;
}

export interface ProviderEvent {
  typeCode: ProviderEventCode;
  minute: number | null;
  teamExternalRef: string;
  playerExternalRef: string | null;
  playerName: string | null;
}

export interface ProviderTeamStats {
  teamExternalRef: string;
  totalShots: number | null;
  shotsOnGoal: number | null;
  cornerKicks: number | null;
  fouls: number | null;
  offsides: number | null;
  goalkeeperSaves: number | null;
}

export interface RawProviderMatch {
  externalRef: string;
  competitionExternalRef: string;
  competitionName: string;
  season: string;
  round: string | null;
  kickoffAt: Date;
  status: 'scheduled' | 'in_progress' | 'finished' | 'cancelled';
  elapsed?: number | null; // minuto atual (ao vivo)
  home: ProviderTeamRef;
  away: ProviderTeamRef;
  refereeName: string | null;
  /** Já traduzidos para o domínio (cartões + APPEARANCE). */
  events: ProviderEvent[];
  /** Estatísticas agregadas por time (chutes, etc.). */
  stats: ProviderTeamStats[];
}

export interface FetchMatchesParams {
  competitionExternalRef: string;
  season: string;
}

export interface ProviderLeagueSeason {
  year: number;
  current: boolean;
  hasEvents: boolean;
  hasStatistics: boolean;
  hasLineups: boolean;
}

export interface ProviderLeague {
  externalRef: string;
  name: string;
  type: string | null;
  country: string | null;
  seasons: ProviderLeagueSeason[];
}

/** Estado ao vivo de UMA partida (status, minuto, eventos e stats atuais). */
export interface ProviderLiveFixture {
  status: RawProviderMatch['status'];
  elapsed: number | null;
  events: ProviderEvent[];
  stats: ProviderTeamStats[];
}

export interface IMatchStatsProvider {
  /** Busca partidas da competição/temporada, já traduzidas para o domínio. */
  fetchMatches(params: FetchMatchesParams): Promise<RawProviderMatch[]>;
  /** Catálogo de todas as ligas + temporadas com cobertura. */
  fetchLeagues(): Promise<ProviderLeague[]>;
  /** Estado ao vivo de um jogo (para o poller). */
  fetchLiveFixture(fixtureId: string): Promise<ProviderLiveFixture>;
}
