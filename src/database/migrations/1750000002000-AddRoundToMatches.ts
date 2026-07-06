import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona `round` (fase da partida: Final, Semi-finals, etc.) e faz backfill
 * a partir do payload cru (raw_provider_payloads) — sem gastar cota do provedor.
 */
export class AddRoundToMatches1750000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "round" varchar(60)`,
    );

    await queryRunner.query(`
      UPDATE "matches" m
      SET "round" = sub.round
      FROM (
        SELECT
          (elem->'fixture'->>'id') AS ext,
          (elem->'league'->>'round') AS round
        FROM raw_provider_payloads, jsonb_array_elements(payload->'response') AS elem
        WHERE resource = 'fixtures'
      ) sub
      WHERE m.external_ref = sub.ext AND sub.round IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN IF EXISTS "round"`);
  }
}
