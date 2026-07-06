import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * Snapshot congelado da análise pré-jogo (a previsão as-of kickoff). Guardar
 * permite comparar previsão × resultado depois e servir de âncora pro ao vivo.
 */
export class CreateMatchAnalysis1750000009000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'match_analysis',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'match_id', type: 'uuid', isUnique: true },
          { name: 'payload', type: 'jsonb' },
          { name: 'captured_at', type: 'timestamp', default: 'now()' },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'match_analysis',
      new TableForeignKey({
        columnNames: ['match_id'],
        referencedTableName: 'matches',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('match_analysis');
  }
}
