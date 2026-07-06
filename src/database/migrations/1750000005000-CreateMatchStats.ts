import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * Estatísticas agregadas por time por partida (chutes, chutes ao gol, etc.).
 * Vêm do endpoint /fixtures/statistics — agregado, não evento por minuto.
 */
export class CreateMatchStats1750000005000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'match_stats',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'match_id', type: 'uuid' },
          { name: 'team_id', type: 'uuid' },
          { name: 'total_shots', type: 'int', isNullable: true },
          { name: 'shots_on_goal', type: 'int', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
        ],
        uniques: [
          { name: 'match_stats_uq', columnNames: ['match_id', 'team_id'] },
        ],
        indices: [{ name: 'idx_match_stats_team', columnNames: ['team_id'] }],
      }),
      true,
    );

    await queryRunner.createForeignKeys('match_stats', [
      new TableForeignKey({
        columnNames: ['match_id'],
        referencedTableName: 'matches',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['team_id'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('match_stats');
  }
}
