import * as fs from 'fs'
import * as path from 'path'
import { Repository, DataSource, EntityManager } from 'typeorm'
import { AuthSession } from './entity/auth_session'
import { AuthUser } from './entity/auth_user'
import { AuthSignup } from './entity/auth_signup'
import { AuthSignupVerify } from './entity/auth_signup_verify'
import { AuthSigninSession } from './entity/auth_signin_session'
import { AuthIdentity } from './entity/auth_identity'
import { AuthWechatAccesstoken } from './entity/auth_wechat_accesstoken'

const ormconfigPath = path.resolve(__dirname, '../ormconfig.json')
const dbConfig = JSON.parse(fs.readFileSync(ormconfigPath).toString())

export const dataSource = new DataSource({
  ...dbConfig,
    entities: [AuthSignup, AuthSignupVerify, AuthSigninSession, AuthIdentity, AuthWechatAccesstoken],
    logging: 'all'
})

export async function initDb() {
  await dataSource.initialize()
}

function getManager() {
  return dataSource.manager
}

export function getSessionRepo(entityManager?: EntityManager): Repository<AuthSession> {
  return (entityManager || getManager()).getRepository(AuthSession)
}

export function getUserRepo(entityManager?: EntityManager): Repository<AuthUser> {
  return (entityManager || getManager()).getRepository(AuthUser)
}

export function getIdentityRepo(entityManager?: EntityManager): Repository<AuthIdentity> {
  return (entityManager || getManager()).getRepository(AuthIdentity)
}

export function getSignupRepo(entityManager?: EntityManager): Repository<AuthSignup> {
  return (entityManager || getManager()).getRepository(AuthSignup)
}

export function getSignupVerifyRepo(entityManager?: EntityManager): Repository<AuthSignupVerify> {
  return (entityManager || getManager()).getRepository(AuthSignupVerify)
}

export function getSigninSessionRepo(entityManager?: EntityManager): Repository<AuthSigninSession> {
  return (entityManager || getManager()).getRepository(AuthSigninSession)
}

export function getWechatAccessTokenRepo(entityManager?: EntityManager): Repository<AuthWechatAccesstoken> {
  return (entityManager || getManager()).getRepository(AuthWechatAccesstoken)
}