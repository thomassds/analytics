import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Corrige a modelagem de competições: antes chaveadas só pelo id da liga
 * (`external_ref` = "1"), o que colapsava World Cup 2022 e 2026 num registro só.
 * Passa a chavear por LIGA + TEMPORADA (`external_ref` = "1-2022" / "1-2026") e
 * reatribui cada jogo para a competição da sua própria `season`.
 * Data-driven (usa matches.season) — funciona para qualquer liga/edição.
 */
export class SplitCompetitionsBySeason1750000004000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. cria uma competição por (liga, temporada) a partir dos jogos existentes
    await queryRunner.query(`
      INSERT INTO competitions (external_ref, name, season)
      SELECT DISTINCT
        split_part(c.external_ref, '-', 1) || '-' || m.season,
        c.name,
        m.season
      FROM matches m
      JOIN competitions c ON c.id = m.competition_id
      ON CONFLICT (external_ref) DO NOTHING
    `);

    // 2. reaponta cada jogo para a competição da sua temporada
    await queryRunner.query(`
      UPDATE matches m
      SET competition_id = nc.id
      FROM competitions c, competitions nc
      WHERE m.competition_id = c.id
        AND nc.external_ref = split_part(c.external_ref, '-', 1) || '-' || m.season
        AND nc.id <> c.id
    `);

    // 3. remove competições órfãs (as antigas chaveadas só pela liga)
    await queryRunner.query(`
      DELETE FROM competitions c
      WHERE NOT EXISTS (SELECT 1 FROM matches m WHERE m.competition_id = c.id)
    `);
  }

  public async down(): Promise<void> {
    // Reverter re-introduziria o bug (competições colapsadas). No-op proposital.
  }
}
