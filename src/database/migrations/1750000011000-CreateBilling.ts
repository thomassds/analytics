import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

/** Planos e assinaturas (billing via Stripe). */
export class CreateBilling1750000011000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'plans',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'name', type: 'varchar', length: '120' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'amount_cents', type: 'int' },
          { name: 'currency', type: 'varchar', length: '3', default: "'brl'" },
          { name: 'interval', type: 'varchar', length: '10', default: "'month'" },
          { name: 'stripe_product_id', type: 'varchar', length: '255', isNullable: true },
          { name: 'stripe_price_id', type: 'varchar', length: '255', isNullable: true },
          { name: 'active', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
          { name: 'deleted_at', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'subscriptions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'user_id', type: 'uuid' },
          { name: 'plan_id', type: 'uuid', isNullable: true },
          { name: 'stripe_customer_id', type: 'varchar', length: '255' },
          { name: 'stripe_subscription_id', type: 'varchar', length: '255', isUnique: true },
          { name: 'status', type: 'varchar', length: '30' },
          { name: 'current_period_start', type: 'timestamp', isNullable: true },
          { name: 'current_period_end', type: 'timestamp', isNullable: true },
          { name: 'cancel_at_period_end', type: 'boolean', default: false },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
        ],
        indices: [{ name: 'idx_subscriptions_user', columnNames: ['user_id'] }],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'subscriptions',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'subscriptions',
      new TableForeignKey({
        columnNames: ['plan_id'],
        referencedTableName: 'plans',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('subscriptions');
    await queryRunner.dropTable('plans');
  }
}
