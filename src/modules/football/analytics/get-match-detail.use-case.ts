import { Injectable } from '@nestjs/common';
import { AppError } from '../../../common/errors/app-error';
import { CatalogRepository } from '../repositories/catalog.repository';
import { playerPhotoUrl, teamLogoUrl } from '../media';

type Side = 'home' | 'away';

interface TeamRef {
  id: string;
  name: string;
  logoUrl: string | null;
}

interface PlayerRef {
  name: string | null;
  photoUrl: string | null;
}

export interface MatchDetail {
  id: string;
  kickoffAt: Date;
  status: number;
  elapsed: number | null; // minuto atual (ao vivo)
  round: string | null;
  refereeName: string | null;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  competition: { id: string; name: string };
  score: { home: number; away: number } | null;
  events: {
    lineup: { home: PlayerRef[]; away: PlayerRef[] };
    goals: Array<{ side: Side; minute: number | null } & PlayerRef>;
    cards: Array<
      { side: Side; kind: 'yellow' | 'red' | 'second'; minute: number | null } & PlayerRef
    >;
  };
  // Estatísticas agregadas por time (match_stats), uma barra por métrica.
  // Só entra a métrica que os dois times têm.
  matchStats: Array<{ label: string; home: number; away: number }>;
}

const CARD_KIND: Record<string, 'yellow' | 'red' | 'second'> = {
  YELLOW_CARD: 'yellow',
  RED_CARD: 'red',
  SECOND_YELLOW: 'second',
};

@Injectable()
export class GetMatchDetailUseCase {
  constructor(private readonly repo: CatalogRepository) {}

  async execute(id: string): Promise<MatchDetail> {
    const m = await this.repo.getMatchRow(id);
    if (!m) throw new AppError('MATCH_NOT_FOUND', 404);

    const rows = await this.repo.getMatchEventRows(id);
    const statRows = await this.repo.getMatchStatsRows(id);
    const sideOf = (teamId: string): Side =>
      teamId === m.homeTeamId ? 'home' : 'away';

    const homeStat = statRows.find((r: any) => r.teamId === m.homeTeamId);
    const awayStat = statRows.find((r: any) => r.teamId === m.awayTeamId);
    const STAT_BARS: Array<{ label: string; key: string }> = [
      { label: 'Chutes', key: 'totalShots' },
      { label: 'Chutes ao gol', key: 'shotsOnGoal' },
      { label: 'Escanteios', key: 'cornerKicks' },
      { label: 'Faltas', key: 'fouls' },
      { label: 'Impedimentos', key: 'offsides' },
      { label: 'Defesas do goleiro', key: 'goalkeeperSaves' },
    ];
    const matchStats: MatchDetail['matchStats'] = [];
    for (const bar of STAT_BARS) {
      const h = homeStat?.[bar.key];
      const a = awayStat?.[bar.key];
      if (h != null && a != null) {
        matchStats.push({ label: bar.label, home: Number(h), away: Number(a) });
      }
    }

    const lineup = { home: [] as PlayerRef[], away: [] as PlayerRef[] };
    const goals: MatchDetail['events']['goals'] = [];
    const cards: MatchDetail['events']['cards'] = [];

    for (const r of rows) {
      const side = sideOf(r.teamId);
      const player: PlayerRef = {
        name: r.playerName,
        photoUrl: playerPhotoUrl(r.playerRef),
      };
      if (r.category === 'appearance') {
        if (player.name) lineup[side].push(player);
      } else if (r.code === 'GOAL') {
        goals.push({ side, minute: r.minute, ...player });
      } else if (CARD_KIND[r.code]) {
        cards.push({ side, kind: CARD_KIND[r.code], minute: r.minute, ...player });
      }
    }

    const score =
      goals.length > 0
        ? {
            home: goals.filter((g) => g.side === 'home').length,
            away: goals.filter((g) => g.side === 'away').length,
          }
        : null;

    return {
      id: m.id,
      kickoffAt: m.kickoffAt,
      status: Number(m.status),
      elapsed: m.elapsed != null ? Number(m.elapsed) : null,
      round: m.round ?? null,
      refereeName: m.refereeName ?? null,
      homeTeam: {
        id: m.homeTeamId,
        name: m.homeTeamName,
        logoUrl: teamLogoUrl(m.homeTeamRef),
      },
      awayTeam: {
        id: m.awayTeamId,
        name: m.awayTeamName,
        logoUrl: teamLogoUrl(m.awayTeamRef),
      },
      competition: { id: m.competitionId, name: m.competitionName },
      score,
      events: { lineup, goals, cards },
      matchStats,
    };
  }
}
