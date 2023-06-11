import { MigrationInterface, QueryRunner } from "typeorm"

export class AlterChatMessageAddVoiceFields1686458250128 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            queryRunner.query(`
            ALTER TABLE chat_message ADD COLUMN media_id character varying(128),
            ADD COLUMN format character varying(16);
            `)
            await queryRunner.commitTransaction()
        } catch (error) {
            console.error(`AlterChatMessageAddVoiceFields1686458250128 failed: ${error}`)
            await queryRunner.rollbackTransaction()
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            queryRunner.query(`
            ALTER TABLE chat_reply DROP COLUMN media_id, DROP COLUMN format;
            `)
            await queryRunner.commitTransaction()
        } catch (error) {
            console.error(`down AlterChatMessageAddVoiceFields1686458250128 failed: ${error}`)
            await queryRunner.rollbackTransaction()
        }
    }

}
