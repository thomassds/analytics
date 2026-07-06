import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Refactor B2C: a plataforma não é mais multi-tenant. Remove as tabelas
 * `user_tenants` e `tenants` (dados do usuário passam a escopar por `user_id`).
 */
export class DropTenantTables1750000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "user_tenants" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "tenants" CASCADE');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recriação mínima (a plataforma é B2C; multi-tenant foi descontinuado).
    await queryRunner.createTable(
      new Table({
        name: 'tenants',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
          { name: 'deleted_at', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'user_tenants',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'user_id', type: 'uuid' },
          { name: 'tenant_id', type: 'uuid' },
          { name: 'role', type: 'varchar', length: '50' },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
          { name: 'deleted_at', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );
  }
}
