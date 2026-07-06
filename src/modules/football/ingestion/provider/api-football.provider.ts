import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { createResolvingHttpsAgent } from '../../../../common/http/resolving-agent';
import { RawProviderPayloadRepository } from '../../repositories/raw-provider-payload.repository';
import {
  FetchMatchesParams,
  IMatchStatsProvider,
  ProviderEvent,
  ProviderEventCode,
  ProviderLeague,
  ProviderTeamStats,
  RawProviderMatch,
} from './match-stats-provider';

/**
 * Implementação do provedor API-Football (acesso direto v3).
 * ÚNICO lugar que conhece o formato do provedor. Grava o cru e traduz.
 */
@Injectable()
export class ApiFootballProvider implements IMatchStatsProvider {
  private readonly logger = new Logger(ApiFootballProvider.name);
  private readonly http: AxiosInstance;
  /** Limite de jogos com detalhe (events+lineups) buscados por run — protege a cota. */
  private readonly maxDetailedPerRun: number;
  /** Intervalo mínimo entre chamadas (free tier = 10 req/min → ~6.5s). */
  private readonly minIntervalMs: number;
  private lastCallAt = 0;

  constructor(
    config: ConfigService,
    private readonly rawRepo: RawProviderPayloadRepository,
  ) {
    this.http = axios.create({
      baseURL:
        config.get<string>('API_FOOTBALL_BASE_URL') ??
        'https://v3.football.api-sports.io',
      headers: { 'x-apisports-key': config.get<string>('API_FOOTBALL_KEY') ?? '' },
      timeout: 20000,
      // resolve DNS por Cloudflare/Google (ISP falha em *.api-sports.io → ENOTFOUND)
      httpsAgent: createResolvingHttpsAgent(),
    });
    this.maxDetailedPerRun = Number(
      config.get<string>('API_FOOTBALL_MAX_DETAILED') ?? 5,
    );
    this.minIntervalMs = Number(
      config.get<string>('API_FOOTBALL_MIN_INTERVAL_MS') ?? 7000,
    );
  }

  private async throttle(): Promise<void> {
    const wait = this.minIntervalMs - (Date.now() - this.lastCallAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastCallAt = Date.now();
  }

  async fetchMatches(params: FetchMatchesParams): Promise<RawProviderMatch[]> {
    const fixtures = await this.get('fixtures', params.competitionExternalRef, {
      league: params.competitionExternalRef,
      season: params.season,
    });

    const matches: RawProviderMatch[] = [];
    let detailedBudget = this.maxDetailedPerRun;

    for (const fx of fixtures) {
      const status = this.mapStatus(fx?.fixture?.status?.short);
      const fixtureId = String(fx?.fixture?.id);

      let events: ProviderEvent[] = [];
      let stats: ProviderTeamStats[] = [];
      // Só busca detalhe (custa cota) de jogos finalizados, respeitando o budget.
      if (status === 'finished' && detailedBudget > 0) {
        events = await this.fetchEvents(fixtureId);
        events = events.concat(await this.fetchLineups(fixtureId));
        stats = await this.fetchStatistics(fixtureId);
        detailedBudget -= 1;
      }

      matches.push({
        externalRef: fixtureId,
        competitionExternalRef: String(fx?.league?.id ?? params.competitionExternalRef),
        competitionName: fx?.league?.name ?? 'Unknown',
        season: String(fx?.league?.season ?? params.season),
        round: fx?.league?.round ?? null,
        kickoffAt: fx?.fixture?.date ? new Date(fx.fixture.date) : new Date(),
        status,
        home: this.mapTeam(fx?.teams?.home),
        away: this.mapTeam(fx?.teams?.away),
        refereeName: fx?.fixture?.referee ?? null,
        events,
        stats,
      });
    }

    this.logger.log(
      `fetchMatches league=${params.competitionExternalRef} season=${params.season}: ${matches.length} fixtures, ${this.maxDetailedPerRun - detailedBudget} detailed`,
    );
    return matches;
  }

  async fetchLiveFixture(fixtureId: string) {
    const rows = await this.get('fixtures', fixtureId, { id: fixtureId });
    const fx = rows[0];
    const status = this.mapStatus(fx?.fixture?.status?.short);
    const elapsed =
      typeof fx?.fixture?.status?.elapsed === 'number'
        ? fx.fixture.status.elapsed
        : null;
    let events = await this.fetchEvents(fixtureId);
    events = events.concat(await this.fetchLineups(fixtureId));
    const stats = await this.fetchStatistics(fixtureId);
    return { status, elapsed, events, stats };
  }

  private async fetchEvents(fixtureId: string): Promise<ProviderEvent[]> {
    const rows = await this.get('events', fixtureId, { fixture: fixtureId });
    const events: ProviderEvent[] = [];
    for (const r of rows) {
      const code = this.mapEventDetail(r?.type, r?.detail);
      if (!code) continue;
      events.push({
        typeCode: code,
        minute: typeof r?.time?.elapsed === 'number' ? r.time.elapsed : null,
        teamExternalRef: String(r?.team?.id),
        playerExternalRef: r?.player?.id != null ? String(r.player.id) : null,
        playerName: r?.player?.name ?? null,
      });
    }
    return events;
  }

  private async fetchLineups(fixtureId: string): Promise<ProviderEvent[]> {
    const rows = await this.get('lineups', fixtureId, { fixture: fixtureId });
    const events: ProviderEvent[] = [];
    for (const teamBlock of rows) {
      const teamRef = String(teamBlock?.team?.id);
      // MVP: APPEARANCE = titulares (startXI). Substitutos que entraram: fase 2.
      for (const item of teamBlock?.startXI ?? []) {
        events.push({
          typeCode: 'APPEARANCE',
          minute: 0,
          teamExternalRef: teamRef,
          playerExternalRef:
            item?.player?.id != null ? String(item.player.id) : null,
          playerName: item?.player?.name ?? null,
        });
      }
    }
    return events;
  }

  async fetchLeagues(): Promise<ProviderLeague[]> {
    await this.throttle();
    const { data } = await this.http.get('/leagues');
    const rows: any[] = Array.isArray(data?.response) ? data.response : [];
    return rows.map((r) => ({
      externalRef: String(r?.league?.id),
      name: r?.league?.name ?? 'Unknown',
      type: r?.league?.type ?? null,
      country: r?.country?.name ?? null,
      seasons: (r?.seasons ?? []).map((s: any) => ({
        year: Number(s?.year),
        current: !!s?.current,
        hasEvents: !!s?.coverage?.fixtures?.events,
        hasStatistics: !!s?.coverage?.fixtures?.statistics_fixtures,
        hasLineups: !!s?.coverage?.fixtures?.lineups,
      })),
    }));
  }

  private async fetchStatistics(fixtureId: string): Promise<ProviderTeamStats[]> {
    const rows = await this.get('statistics', fixtureId, { fixture: fixtureId });
    const out: ProviderTeamStats[] = [];
    for (const teamBlock of rows) {
      const list: any[] = teamBlock?.statistics ?? [];
      const val = (type: string): number | null => {
        const s = list.find((x) => x?.type === type);
        return s && s.value != null ? Number(s.value) : null;
      };
      out.push({
        teamExternalRef: String(teamBlock?.team?.id),
        totalShots: val('Total Shots'),
        shotsOnGoal: val('Shots on Goal'),
        cornerKicks: val('Corner Kicks'),
        fouls: val('Fouls'),
        offsides: val('Offsides'),
        goalkeeperSaves: val('Goalkeeper Saves'),
      });
    }
    return out;
  }

  /** GET genérico: grava o payload cru e retorna `response`. */
  private async get(
    resource: string,
    externalRef: string,
    query: Record<string, string | number>,
  ): Promise<any[]> {
    const path = resource === 'fixtures' ? '/fixtures' : `/fixtures/${resource}`;

    let data: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.throttle();
      try {
        ({ data } = await this.http.get(path, { params: query }));
        break;
      } catch (err: any) {
        if (err?.response?.status === 429 && attempt < 2) {
          this.logger.warn(`429 rate limited em ${resource}; aguardando 60s...`);
          await new Promise((r) => setTimeout(r, 60000));
          continue;
        }
        throw err;
      }
    }

    await this.rawRepo.upsert({
      provider: 'api-football',
      resource,
      externalRef,
      payload: data,
    });

    if (Array.isArray(data?.errors) && data.errors.length) {
      this.logger.warn(`API-Football ${resource} errors: ${JSON.stringify(data.errors)}`);
    }
    return Array.isArray(data?.response) ? data.response : [];
  }

  private mapStatus(short?: string): RawProviderMatch['status'] {
    if (!short) return 'scheduled';
    if (['FT', 'AET', 'PEN'].includes(short)) return 'finished';
    // não vai acontecer: cancelado, adiado, abandonado, W.O., técnico
    if (['CANC', 'PST', 'ABD', 'AWD', 'WO'].includes(short)) return 'cancelled';
    if (['NS', 'TBD', 'SUSP', 'INT'].includes(short)) return 'scheduled';
    return 'in_progress';
  }

  private mapEventDetail(type?: string, detail?: string): ProviderEventCode | null {
    if (type === 'Goal') {
      // ignora pênalti perdido (é type Goal no provedor)
      return detail === 'Missed Penalty' ? null : 'GOAL';
    }
    if (type !== 'Card') return null;
    if (detail === 'Yellow Card') return 'YELLOW_CARD';
    if (detail === 'Red Card') return 'RED_CARD';
    if (detail === 'Second Yellow card') return 'SECOND_YELLOW';
    return null;
  }

  private mapTeam(t: any): RawProviderMatch['home'] {
    return {
      externalRef: String(t?.id),
      name: t?.name ?? 'Unknown',
      country: null,
    };
  }
}
