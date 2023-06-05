import {MigrationInterface, QueryRunner} from "typeorm";
import { AuthSession } from '../entity/auth_session'
import { AuthUser } from '../entity/auth_user'
import { AuthSignup } from '../entity/auth_signup'
import { AuthSignupVerify } from '../entity/auth_signup_verify'
import { AuthSigninSession } from '../entity/auth_signin_session'
import { AuthIdentity } from '../entity/auth_identity'
import { AUTH_STATUS_OK, AUTH_TYPE_EMAIL } from "../constants";
import { createEmailVerifyCode } from "../ctrls/helper/auth_helper";
import { log } from "console";

export class migrateExistingUser1685460512307 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.connection.transaction(async (manager) => {
            let users: AuthUser[] = []
            try {
                users = await manager.getRepository(AuthUser).find()
            } catch (e) {
                console.error(`db query fail: ${e}`)
                return
            }
            console.log(`users to migrate: ${JSON.stringify(users, null, 4)}`)
            const now = new Date()
            const IdentityRepo = manager.getRepository(AuthIdentity)
            const SignupRepo = manager.getRepository(AuthSignup)
            const SignupVerifyRepo = manager.getRepository(AuthSignupVerify)
            const dummyCode = 'dummy_'
            await IdentityRepo.insert(users.map(user => ({
                username: user.email,
                createdAt: now,
                updatedAt: now,
            })))
            const allIdentities = await IdentityRepo.find()
            const identityMap: any = allIdentities.reduce((acc, cur) => {
                return { [cur.username!]: cur, ...acc }
            }, {})
            await SignupRepo.insert(users.map(user => ({
                authId: user.email,
                authType: AUTH_TYPE_EMAIL,
                credential: user.password,
                identity: identityMap[user.email!],
                createdAt: now,
                updatedAt: now,
            })))
            await SignupVerifyRepo.insert(users.map(user => ({
                authId: user.email,
                authType: AUTH_TYPE_EMAIL,
                code: dummyCode,
                authStatus: AUTH_STATUS_OK,
                createdAt: now,
                updatedAt: now,
            })))
        })
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('migrateExistingUser1685460512307 down: noop')
    }

}
