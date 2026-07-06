import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * Schema do domínio de futebol (reference data GLOBAL — B2C, sem tenant/user).
 * Ver specs/football-analytics/01-data-ingestion-acl.md.
 */
export class CreateFootballSchema1750000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // raw_provider_payloads (landing zone) ---------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'raw_provider_payloads',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'provider', type: 'varchar', length: '40' },
          { name: 'resource', type: 'varchar', length: '40' },
          { name: 'external_ref', type: 'varchar', length: '100' },
          { name: 'payload', type: 'jsonb' },
          { name: 'fetched_at', type: 'timestamp', default: 'now()' },
          { name: 'processed_at', type: 'timestamp', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
        ],
        uniques: [
          {
            name: 'raw_payloads_ref_uq',
            columnNames: ['provider', 'resource', 'external_ref'],
          },
        ],
        indices: [
          { name: 'idx_raw_payloads_unprocessed', columnNames: ['processed_at'] },
        ],
      }),
      true,
    );

    // competitions ---------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'competitions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'external_ref', type: 'varchar', length: '100', isUnique: true },
          { name: 'name', type: 'varchar', length: '150' },
          { name: 'season', type: 'varchar', length: '20' },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    // teams ----------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'teams',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'external_ref', type: 'varchar', length: '100', isUnique: true },
          { name: 'name', type: 'varchar', length: '150' },
          { name: 'country', type: 'varchar', length: '80', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    // players --------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'players',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'external_ref', type: 'varchar', length: '100', isUnique: true },
          { name: 'name', type: 'varchar', length: '150' },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    // referees -------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'referees',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'name', type: 'varchar', length: '150', isUnique: true },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    // event_types (catálogo fiel — SEM weight) -----------------------------
    await queryRunner.createTable(
      new Table({
        name: 'event_types',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'code', type: 'varchar', length: '40', isUnique: true },
          { name: 'category', type: 'varchar', length: '40' },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    // matches --------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'matches',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'external_ref', type: 'varchar', length: '100', isUnique: true },
          { name: 'competition_id', type: 'uuid' },
          { name: 'home_team_id', type: 'uuid' },
          { name: 'away_team_id', type: 'uuid' },
          { name: 'referee_id', type: 'uuid', isNullable: true },
          { name: 'season', type: 'varchar', length: '20' },
          { name: 'kickoff_at', type: 'timestamp' },
          { name: 'status', type: 'int', default: 0 },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
        ],
        indices: [
          {
            name: 'idx_matches_competition',
            columnNames: ['competition_id', 'season', 'status'],
          },
          { name: 'idx_matches_home_team', columnNames: ['home_team_id'] },
          { name: 'idx_matches_away_team', columnNames: ['away_team_id'] },
        ],
      }),
      true,
    );

    // match_events (evento atômico) ----------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'match_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'match_id', type: 'uuid' },
          { name: 'event_type_id', type: 'uuid' },
          { name: 'team_id', type: 'uuid' },
          { name: 'player_id', type: 'uuid', isNullable: true },
          { name: 'minute', type: 'int', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
        ],
        indices: [
          { name: 'idx_match_events_match', columnNames: ['match_id', 'event_type_id'] },
          { name: 'idx_match_events_team', columnNames: ['team_id', 'event_type_id'] },
          { name: 'idx_match_events_player', columnNames: ['player_id', 'event_type_id'] },
        ],
      }),
      true,
    );

    // foreign keys ---------------------------------------------------------
    await queryRunner.createForeignKeys('matches', [
      new TableForeignKey({
        columnNames: ['competition_id'],
        referencedTableName: 'competitions',
        referencedColumnNames: ['id'],
      }),
      new TableForeignKey({
        columnNames: ['home_team_id'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
      }),
      new TableForeignKey({
        columnNames: ['away_team_id'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
      }),
      new TableForeignKey({
        columnNames: ['referee_id'],
        referencedTableName: 'referees',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await queryRunner.createForeignKeys('match_events', [
      new TableForeignKey({
        columnNames: ['match_id'],
        referencedTableName: 'matches',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['event_type_id'],
        referencedTableName: 'event_types',
        referencedColumnNames: ['id'],
      }),
      new TableForeignKey({
        columnNames: ['team_id'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
      }),
      new TableForeignKey({
        columnNames: ['player_id'],
        referencedTableName: 'players',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    // seed do catálogo de eventos -----------------------------------------
    await queryRunner.query(`
      INSERT INTO event_types (code, category) VALUES
        ('YELLOW_CARD', 'yellow'),
        ('RED_CARD', 'red'),
        ('SECOND_YELLOW', 'yellow'),
        ('APPEARANCE', 'appearance')
      ON CONFLICT (code) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('match_events');
    await queryRunner.dropTable('matches');
    await queryRunner.dropTable('event_types');
    await queryRunner.dropTable('referees');
    await queryRunner.dropTable('players');
    await queryRunner.dropTable('teams');
    await queryRunner.dropTable('competitions');
    await queryRunner.dropTable('raw_provider_payloads');
  }
}
