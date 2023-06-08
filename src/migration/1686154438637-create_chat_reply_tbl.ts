import { MigrationInterface, QueryRunner, Table } from "typeorm"

export class CreateChatReplyTbl1686154438637 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            await queryRunner.createTable(new Table({
                name: 'chat_reply',
                columns: [
                    { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                    { name: 'reply', type: 'text', isNullable: true },
                    { name: 'load_status', type: 'int', isNullable: false, default: 2 },
                    { name: 'replied', type: 'boolean', isNullable: false, default: false },
                    { name: 'created_at', type: 'timestamp', isNullable: false },
                    { name: 'loaded_at', type: 'timestamp', isNullable: true },
                ]
            }))
            await queryRunner.commitTransaction()
        } catch (error) {
            console.error(`failed to create reply table: ${error}`)
            await queryRunner.rollbackTransaction()
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            await queryRunner.dropTable('chat_reply')
            await queryRunner.commitTransaction()
        } catch (error) {
            console.error(`failed to drop reply table: ${error}`)
            await queryRunner.rollbackTransaction()
        }
    }

}
