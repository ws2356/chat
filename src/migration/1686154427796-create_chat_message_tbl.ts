import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm"

export class CreateChatMessageTbl1686154427796 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            await queryRunner.createTable(new Table({
                name: 'chat_message',
                columns: [
                    { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                    { name: 'auth_type', type: 'int', isNullable: false },
                    { name: 'auth_id', type: 'varchar', length: '128', isNullable: false },
                    { name: 'msg_id', type: 'varchar', length: '128', isNullable: false },
                    { name: 'msg_type', type: 'varchar', length: '32', isNullable: false },
                    { name: 'content', type: 'text', isNullable: false },
                    { name: 'to_user_name', type: 'varchar', length: '128', isNullable: false },
                    { name: 'create_time', type: 'timestamp', isNullable: false },
                    { name: 'reply_id', type: 'int', isNullable: true },
                ]
            }))
            await queryRunner.createIndex('chat_message', new TableIndex({
                name: 'idx_auth_id_type_msg_id',
                columnNames: ['auth_id', 'auth_type', 'msg_id'],
                isUnique: true
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
            await queryRunner.dropIndex('chat_message', 'idx_auth_id_type_msg_id')
            await queryRunner.dropTable('chat_message')
            await queryRunner.commitTransaction()
        } catch (error) {
            console.error(`failed to drop message table: ${error}`)
            await queryRunner.rollbackTransaction()
        }
    }

}
