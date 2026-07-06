import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { League } from '../entities/league.entity';
import { Competition } from '../entities/competition.entity';

export interface IngestTarget {
  leagueRef: string;
  leagueName: string;
  isNational: boolean;
  seasons: number[];
}

@Injectable()
export class LeagueCatalogRepository {
  constructor(
    @InjectRepository(League) private readonly leagues: Repository<League>,
    @InjectRepository(Competition)
    private readonly competitions: Repository<Competition>,
  ) {}

  private get db() {
    return this.leagues.manager;
  }

  async upsertLeague(data: {
    externalRef: string;
    name: string;
    type: string | null;
    country: string | null;
  }): Promise<string> {
    await this.leagues.upsert(
      { externalRef: data.externalRef, name: data.name, type: data.type, country: data.country },
      { conflictPaths: ['externalRef'] },
    );
    const row = await this.leagues.findOne({
      where: { externalRef: data.externalRef },
    });
    return row!.id;
  }

  /** Upsert da temporada coberta como competition (liga-temporada). */
  async upsertCompetitionSeason(data: {
    externalRef: string; // "leagueRef-year"
    name: string;
    season: string;
    leagueId: string;
    hasEvents: boolean;
    hasStatistics: boolean;
    hasLineups: boolean;
    isCurrent: boolean;
  }): Promise<void> {
    await this.competitions.upsert(data, { conflictPaths: ['externalRef'] });
  }

  /** Marca as ligas famosas para ingestão (idempotente). */
  async enableFamous(
    nationalRefs: string[],
    clubRefs: string[],
  ): Promise<void> {
    if (nationalRefs.length)
      await this.db.query(
        `UPDATE leagues SET ingest_enabled = true, is_national = true WHERE external_ref = ANY($1)`,
        [nationalRefs],
      );
    if (clubRefs.length)
      await this.db.query(
        `UPDATE leagues SET ingest_enabled = true, is_national = false WHERE external_ref = ANY($1)`,
        [clubRefs],
      );
  }

  /**
   * Alvos de ingestão: ligas habilitadas × temporadas com eventos, aplicando o
   * cutoff (seleções ≥ 2016, clubes ≥ 2020). `scope` restringe a clubes ou
   * seleções (evita re-sincronizar o que não interessa naquele run).
   */
  async getIngestTargets(
    scope: 'all' | 'club' | 'national' = 'all',
  ): Promise<IngestTarget[]> {
    const scopeCond =
      scope === 'club'
        ? 'AND l.is_national = false'
        : scope === 'national'
          ? 'AND l.is_national = true'
          : '';
    const rows = await this.db.query(`
      SELECT l.external_ref AS "leagueRef", l.name AS "leagueName",
             l.is_national AS "isNational", c.season::int AS year
      FROM leagues l
      JOIN competitions c ON c.league_id = l.id
      WHERE l.ingest_enabled = true
        AND c.has_events = true
        ${scopeCond}
        AND c.season::int >= CASE WHEN l.is_national THEN 2016 ELSE 2020 END
      ORDER BY l.external_ref, year DESC
    `);
    const map = new Map<string, IngestTarget>();
    for (const r of rows) {
      const t: IngestTarget = map.get(r.leagueRef) ?? {
        leagueRef: r.leagueRef,
        leagueName: r.leagueName,
        isNational: r.isNational,
        seasons: [],
      };
      t.seasons.push(Number(r.year));
      map.set(r.leagueRef, t);
    }
    return [...map.values()];
  }
}
