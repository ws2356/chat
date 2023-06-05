import express from 'express'
import { InsertResult } from "typeorm"
import { v4 as uuidv4 } from 'uuid'
import { parse as parseTld } from 'tldts'
import config from 'config'
import md5 from 'md5'
import { getSessionRepo, getUserRepo, getSignupRepo, getSignupVerifyRepo, getSigninSessionRepo, getIdentityRepo, dataSource, getWechatAccessTokenRepo } from '../db'
import { AuthIdentity } from '../entity/auth_identity'
import { AuthSignup } from '../entity/auth_signup'
import { AuthSigninSession } from '../entity/auth_signin_session'
import { AuthSignupVerify } from '../entity/auth_signup_verify'
import { AuthWechatAccesstoken } from '../entity/auth_wechat_accesstoken'
import { checkSignupStatus, createEmailVerifyCode, sendEmail, refreshWechatAccessToken } from './helper/auth_helper'
import { AUTH_STATUS_OK, AUTH_STATUS_PENDING, AUTH_TYPE_EMAIL, MLGB_ACCESS_TOKEN_RESERVE_FRESH_MS, MLGB_CLIENT_ID, AUTH_TYPE_MLGB } from '../constants'

const urlRegex = /https?:\/\//i

const tokenName = 'token-of-auth'

const authSessionTtl = config.get('authSessionTtl') as number

console.log(`authSessionTtl ttl: ${authSessionTtl}`)

export async function verify(req: express.Request, res: express.Response) {
  res.type('text/plain')

  await dataSource.transaction(async (manager) => {
    const { cookies } = req
    const { [tokenName]: token } = cookies || {}
    const now = Date.now()

    let sessionModel: AuthSigninSession | null = null
    try {
      if (typeof token === 'string') {
        sessionModel = await getSigninSessionRepo(manager).findOne({ where: { token } })
      }
    } catch (e) {
      console.error(`db query fail: ${e}`)
      res.status(401).send('unauthenticated')
      return
    }

    if (sessionModel) {
      console.log(`session exists: ${sessionModel.createdAt}`)
      if (sessionModel.createdAt && now - sessionModel.createdAt!.getTime() < authSessionTtl) {
        res.status(200).send('ok')
        return
      }
    }
    console.log('no valid session')
    res.status(401).send('unauthenticated')
  })
}

export async function signin(req: express.Request, res: express.Response) {
  res.type('text/plain')
  await dataSource.transaction(async (manager) => {
    const data = req.body || {}
    console.log(`body: ${JSON.stringify(data, null, 4)}`)
    const { email, password, redirection, deviceId } = data
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).send('bad arg')
      return
    }
    const encodedPass = md5(password)
    const now = new Date()

    let signupInfo: AuthSignup | null = null
    try {
      if (!await checkSignupStatus(manager, AUTH_TYPE_EMAIL, email)) {
        res.status(401).send('signup not finished yet')
        return
      }

      signupInfo = await getSignupRepo(manager).findOne({
        where: {
          authId: email,
          authType: AUTH_TYPE_EMAIL,
          credential: encodedPass
        }
      })
      if (!signupInfo) {
        console.error('unknown signupInfo')
        res.status(401).send('unknown signupInfo')
        return
      }
    } catch (e) {
      console.error(`db query fail: ${e}`)
      res.status(500).send('server fail')
      return
    }

    const newToken = uuidv4()
    const session = new AuthSigninSession()
    session.token = newToken
    session.signup = signupInfo
    session.createdAt = now
    session.deviceId = deviceId || null

    try {
      await getSigninSessionRepo(manager).save(session)
    } catch (e) {
      console.error(`db query fail: ${e}`)
      res.status(500).send('server fail')
      return
    }

    const cookieExpire = new Date()
    cookieExpire.setMilliseconds(cookieExpire.getMilliseconds() + authSessionTtl)
    const opts: express.CookieOptions = { expires: cookieExpire }
    const publicHost = req.get('X-Forwarded-Host')
    if (publicHost) {
      const domain = parseTld(publicHost).domain
      if (domain) {
        opts.domain = domain
      }
    }
    res.cookie(tokenName, newToken, opts)
    if (typeof redirection === 'string' && urlRegex.test(redirection)) {
      res.location(redirection)
      console.log(`redirecting to: ${redirection}`)
      res.status(302).send('redirecting')
    } else {
      res.status(200).send('ok')
    }
  })
}

export async function signup(req: express.Request, res: express.Response) {
  res.type('text/plain')

  const now = new Date()
  const { email, password, username, deviceId, code, source } = req.body || {}
  if (typeof email !== 'string' ||
    typeof deviceId !== 'string' ||
    typeof password !== 'string' ||
    typeof code !== 'string') {
    res.status(400).send('bad arg')
    return
  }

  await dataSource.transaction(async (manager) => {
    let signupVerifyInfo: AuthSignupVerify | null
    try {
      signupVerifyInfo = await getSignupVerifyRepo(manager).findOne({
        where: {
          authId: email,
          authType: AUTH_TYPE_EMAIL
        }})
      if (!signupVerifyInfo) {
        res.status(401).send('email not verified')
        return
      }
      if (signupVerifyInfo.authStatus !== AUTH_STATUS_PENDING) {
        res.status(401).send('email verification failed')
        return
      }
      if (signupVerifyInfo.code !== code) {
        res.status(401).send('email verification failed')
        return
      }
      // TODO: add expiration check
    } catch (e) {
      console.error(`db query fail: ${e}`)
      res.status(500).send('db query fail')
      return
    }
    signupVerifyInfo.authStatus = AUTH_STATUS_OK

    try {
      await getSignupVerifyRepo(manager).save(signupVerifyInfo)
    } catch (e) {
      console.error(`email verification failed because of db error: ${e}`)
      res.status(500).send('email verification failed because of db error')
      return
    }

    let identityInfo: AuthIdentity | null = null
    try {
      const insertIdentityRes = await getIdentityRepo(manager).insert({
        username: username || email,
        createdAt: now,
        updatedAt: now,
      })
      const { id } = insertIdentityRes.identifiers[0] || {}
      if (typeof id !== 'number') {
        res.status(500).send('server error')
        return
      }
      identityInfo = await getIdentityRepo(manager).findOne({ where: { id } })
      if (!identityInfo) {
        res.status(500).send('server error')
        return
      }
    } catch (err) {
      /* handle error */
      res.status(500).send(`server error: ${err}`)
      return
    }

    try {
      await getSignupRepo(manager).insert({
        authType: AUTH_TYPE_EMAIL,
        authId: email,
        credential: md5(password),
        createdAt: now,
        updatedAt: now,
        identity: identityInfo,
        source,
        deviceId
      })
      res.status(200).send('ok')
    } catch (err) {
      /* handle error */
      // TODO: throw if exception other than dup
      console.error(`failed to insert: ${email}, ${err}`)
      res.status(500).send(`server error: ${err}`)
    }
  })

}

export async function signupVerify(req: express.Request, res: express.Response) {
  res.type('text/plain')
  const { email, deviceId } = req.body || {}
  if (typeof email !== 'string' || typeof deviceId !== 'string') {
    res.status(400).send('bad arg')
    return
  }

  await dataSource.transaction(async (manager) => {
    let signupVerifyInfo: AuthSignupVerify | null = null
    try {
      signupVerifyInfo = await getSignupVerifyRepo(manager).findOne({
        where: {
        authId: email,
        authType: AUTH_TYPE_EMAIL,
      }})
    } catch (err) {
      console.error(`failed to verify signup: ${err}`)
      res.status(500).send('failed')
    }

    const emailVerifyCode = createEmailVerifyCode()
    const now = new Date()

    if (!signupVerifyInfo) {
      const insertRes = await getSignupVerifyRepo(manager).insert({
        authId: email,
        authType: AUTH_TYPE_EMAIL,
        authStatus: AUTH_STATUS_PENDING,
        createdAt: now,
        updatedAt: now,
        deviceId,
        code: emailVerifyCode,
      })
      const recordId = insertRes.identifiers[0].id
      signupVerifyInfo = await getSignupVerifyRepo(manager)
        .findOne({ where: { id: recordId } })
      res.status(200).send('ok')
      return
    } else if (signupVerifyInfo.authStatus === AUTH_STATUS_OK) {
      res.status(400).send('already verified')
      return
    }

    signupVerifyInfo.code = emailVerifyCode
    signupVerifyInfo.updatedAt = now
    signupVerifyInfo.authStatus = AUTH_STATUS_PENDING
    try {
      await getSignupVerifyRepo(manager).save(signupVerifyInfo)
    } catch (err) {
      console.error(`failed to verify signup: ${err}`)
      res.status(500).send('failed')
    }

    const subject = 'Email verification'
    const html = `
    <html>
    <body>
    <p>Welcome to <strong>wansong.vip</strong>. Use the following code to verify your email: ${emailVerifyCode}.</p>
    </body>
    </html>
    `
    try {
      await sendEmail(subject, email, html)
      res.status(200).send('ok')
    } catch (err) {
      console.error(`failed to send verify email: ${err}`)
      res.status(500).send('failed')
      return
    }
  })
}

export async function autoSignup(req: express.Request, res: express.Response) {
  res.type('text/plain')
  const { wechatClientId, wechatOpenId, deviceId } = req.body || {}
  if (wechatClientId !== MLGB_CLIENT_ID) {
    res.status(400).send('not supported yet')
    return
  }
  if (typeof wechatOpenId !== 'string') {
    res.status(400).send('bad arg')
    return
  }
  await dataSource.transaction(async (manager) => {
    let signupInfo: AuthSignup | null = null
    try {
      signupInfo = await getSignupRepo(manager).findOne({
        where: {
          authId: wechatOpenId,
          authType: AUTH_TYPE_MLGB,
        }
      })
    } catch (err) {
      console.error(`failed to auto signup: ${err}`)
      res.status(500).send('failed')
      return
    }
    if (signupInfo) {
      res.status(200).send('ok')
      return
    }

    const now = new Date()
    let identityInfo: AuthIdentity | null = null
    try {
      const insertIdentityRes = await getIdentityRepo(manager).insert({
        username: wechatOpenId,
        createdAt: now,
        updatedAt: now,
      })
      const { id } = insertIdentityRes.identifiers[0] || {}
      if (typeof id !== 'number') {
        res.status(500).send('server error')
        return
      }
      identityInfo = await getIdentityRepo(manager).findOne({ where: { id } })
      if (!identityInfo) {
        res.status(500).send('server error')
        return
      }
    } catch (err) {
      /* handle error */
      res.status(500).send(`server error: ${err}`)
      return
    }

    try {
      await getSignupRepo(manager).insert({
        authType: AUTH_TYPE_MLGB,
        authId: wechatOpenId,
        createdAt: now,
        updatedAt: now,
        identity: identityInfo,
        source: 'wechat',
        deviceId: deviceId || '',
        credential: '1',
      })
      res.status(200).send('ok')
    } catch (err) {
      /* handle error */
      res.status(500).send(`server error: ${err}`)
    }
  })
}

export async function getAccessToken(req: express.Request, res: express.Response) {
  res.type('application/json')
  const { clientId } = req.body || {}
  if (clientId !== MLGB_CLIENT_ID) {
    res.status(400).send('not supported yet')
    return
  }

  await dataSource.transaction(async (manager) => {
    let record: AuthWechatAccesstoken | null = null
    try {
      record = await getWechatAccessTokenRepo(manager).findOne({ where: { clientId } })
    } catch (error) {
      console.error(`failed to get access token: ${error}`)
      res.status(500).send('server error')
      return
    }

    // TODO: check how rollback works
    if (!record || record.expiresAt.getTime() - new Date().getTime() < MLGB_ACCESS_TOKEN_RESERVE_FRESH_MS) {
      try {
        const token = await refreshWechatAccessToken(manager)
        res.send(JSON.stringify({ token }))
      } catch (error) {
        console.error(`failed to refresh access token: ${error}`)
        res.status(500).send('server error')
      }
      return 
    }

    return res.send(JSON.stringify({ token: record.token }))
  })
}