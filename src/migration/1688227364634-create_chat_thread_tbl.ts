import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm"

export class CreateChatThreadTbl1688227364634 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            await queryRunner.createTable(new Table({
                name: 'chat_thread',
                columns: [
                    { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                    { name: 'auth_type', type: 'int', isNullable: false },
                    { name: 'auth_id', type: 'varchar', length: '128', isNullable: false },
                    { name: 'to_user_name', type: 'varchar', length: '32', isNullable: false },
                    { name: 'completed', type: 'boolean', isNullable: false },
                    { name: 'created_at', type: 'timestamp with time zone', isNullable: false },
                    { name: 'updated_at', type: 'timestamp with time zone', isNullable: false },
                ]
            }))
            await queryRunner.createIndex('chat_thread', new TableIndex({
                name: 'idx_thread_auth_id_type',
                columnNames: ['auth_id', 'auth_type'],
            }))
            await queryRunner.commitTransaction()
        } catch (error) {
            console.error(`failed to drop create message table: ${error}`)
            await queryRunner.rollbackTransaction()
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            await queryRunner.dropIndex('chat_thread', 'idx_thread_auth_id_type')
            await queryRunner.dropTable('chat_thread')
            await queryRunner.commitTransaction()
        } catch (error) {
            console.error(`failed to drop reply table: ${error}`)
            await queryRunner.rollbackTransaction()
        }
    }

}
