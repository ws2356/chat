import { MigrationInterface, QueryRunner } from "typeorm"

export class AlterTableChatMessageAddColumnChatThreadId1688228098515 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            await queryRunner.query(`ALTER TABLE chat_message ADD COLUMN chat_thread_id integer NOT NULL DEFAULT 0;`)
            await queryRunner.commitTransaction()
        } catch (error) {
            console.error(`AlterTableChatMessageAddColumnChatThreadId1688228098515 failed: ${error}`)
            await queryRunner.rollbackTransaction()
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            await queryRunner.query(`ALTER TABLE chat_message DROP COLUMN chat_thread_id;`)
            await queryRunner.commitTransaction()
        } catch (error) {
            console.error(`AlterTableChatMessageAddColumnChatThreadId1688228098515 down failed: ${error}`)
            await queryRunner.rollbackTransaction()
        }
    }

}
