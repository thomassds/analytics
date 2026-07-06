import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

/**
 * Catálogo de ligas. `leagues` = a liga em si (pai): guarda a decisão de puxar
 * (ingest_enabled) e se é seleção. `competitions` (já existe, por liga-temporada)
 * ganha o vínculo com a liga + flags de cobertura do provedor.
 */
export class CreateLeagueCatalog1750000006000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'leagues',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'external_ref', type: 'varchar', length: '20', isUnique: true },
          { name: 'name', type: 'varchar', length: '150' },
          { name: 'type', type: 'varchar', length: '20', isNullable: true },
          { name: 'country', type: 'varchar', length: '80', isNullable: true },
          { name: 'is_national', type: 'boolean', default: false },
          { name: 'ingest_enabled', type: 'boolean', default: false },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
        ],
        indices: [{ name: 'idx_leagues_ingest', columnNames: ['ingest_enabled'] }],
      }),
      true,
    );

    // competitions (liga-temporada) ganha vínculo com a liga + cobertura
    await queryRunner.addColumns('competitions', [
      new TableColumn({ name: 'league_id', type: 'uuid', isNullable: true }),
      new TableColumn({ name: 'has_events', type: 'boolean', default: false }),
      new TableColumn({ name: 'has_statistics', type: 'boolean', default: false }),
      new TableColumn({ name: 'has_lineups', type: 'boolean', default: false }),
      new TableColumn({ name: 'is_current', type: 'boolean', default: false }),
    ]);

    await queryRunner.createForeignKey(
      'competitions',
      new TableForeignKey({
        columnNames: ['league_id'],
        referencedTableName: 'leagues',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('competitions');
    const fk = table?.foreignKeys.find((f) => f.columnNames.includes('league_id'));
    if (fk) await queryRunner.dropForeignKey('competitions', fk);
    await queryRunner.dropColumns('competitions', [
      'league_id',
      'has_events',
      'has_statistics',
      'has_lineups',
      'is_current',
    ]);
    await queryRunner.dropTable('leagues');
  }
}
