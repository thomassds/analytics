import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adiciona o tipo de evento GOAL ao catálogo (category 'goal'). */
export class AddGoalEventType1750000003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO event_types (code, category) VALUES ('GOAL', 'goal')
      ON CONFLICT (code) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM event_types WHERE code = 'GOAL'`);
  }
}
