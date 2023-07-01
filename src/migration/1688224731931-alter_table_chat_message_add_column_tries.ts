import { MigrationInterface, QueryRunner } from "typeorm"

export class AlterTableChatMessageAddColumnTries1688224731931 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            await queryRunner.query(`ALTER TABLE chat_message ADD COLUMN tries integer NOT NULL DEFAULT 0;`)
            await queryRunner.commitTransaction()
        } catch (error) {
            console.error(`AlterTableChatMessageAddColumnTries1688224731931 failed: ${error}`)
            await queryRunner.rollbackTransaction()
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            await queryRunner.query(`ALTER TABLE chat_message DROP COLUMN tries;`)
            await queryRunner.commitTransaction()
        } catch (error) {
            console.error(`AlterTableChatMessageAddColumnTries1688224731931 down failed: ${error}`)
            await queryRunner.rollbackTransaction()
        }
    }

}
