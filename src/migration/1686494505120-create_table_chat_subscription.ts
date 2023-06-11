import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm"

export class CreateTableChatSubscription1686494505120 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            await queryRunner.createTable(new Table({
                name: 'chat_subscription',
                columns: [
                    { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                    { name: 'auth_type', type: 'int', isNullable: false },
                    { name: 'auth_id', type: 'varchar(128)', isNullable: false },
                    { name: 'to_user_name', type: 'varchar(32)', isNullable: false },
                    { name: 'create_time', type: 'timestamp with time zone', isNullable: false },
                    { name: 'event', type: 'varchar(16)', isNullable: false },
                ]
            }))
            await queryRunner.createIndex('chat_subscription', new TableIndex({
                name: 'idx_subscription_auth_id_type_create_time',
                columnNames: ['auth_id', 'auth_type', 'create_time'],
                }))
            await queryRunner.commitTransaction()
        } catch (error) {
            console.error(`failed to drop create subscription table: ${error}`)
            await queryRunner.rollbackTransaction()
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            await queryRunner.dropIndex('chat_subscription', 'idx_subscription_auth_id_type_create_time')
            await queryRunner.dropTable('chat_subscription')
            await queryRunner.commitTransaction()
        } catch (error) {
            console.error(`failed to drop subscription table: ${error}`)
            await queryRunner.rollbackTransaction()
        }
    }

}
