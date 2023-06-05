import nodemailer from 'nodemailer'
import { EntityManager } from 'typeorm'
import * as qs from 'qs'
import axios from 'axios'
import { getSignupRepo, getSignupVerifyRepo, getWechatAccessTokenRepo } from '../../db'

import { AUTH_STATUS_OK, WECHAT_API_BASE, MLGB_CLIENT_ID, AUTH_TYPE_MLGB } from '../../constants'

export async function checkSignupStatus(entityManager: EntityManager, authType: number, authId: string): Promise<boolean> {
  try {
    if (authType === AUTH_TYPE_MLGB) {
      return checkMlgbSignupStatus(entityManager, authId)
    }
    const signupInfo = await getSignupVerifyRepo(entityManager).findOne({
      where: { authId, authType } })
    if (!signupInfo) {
      return false
    }
    return signupInfo.authStatus === AUTH_STATUS_OK
  } catch (err) {
    /* handle error */
    console.error(`failed to checkSignupStatus: ${err}`)
    return false
  }
}

async function checkMlgbSignupStatus(entityManager: EntityManager, wechatOpenId: string): Promise<boolean> {
  try {
    const signupInfo = await getSignupRepo(entityManager)
      .findOne({
        where: { authType: AUTH_TYPE_MLGB, authId: wechatOpenId }
      })
    return !!signupInfo
  } catch (err) {
    /* handle error */
    console.error(`failed to checkMlgbSignupStatus: ${err}`)
    return false
  }
}

export async function sendEmail (subject: string, to: string, html: string) {
  const transportInfo = {
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT || '587') || 587,
    secure: true,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    name: process.env.MAIL_SERVER_NAME,
  }

  const transporter = nodemailer.createTransport(transportInfo);
  const fromUser = `${transportInfo.auth.user} <${transportInfo.auth.user}@${transportInfo.name}>`
  await transporter.sendMail({
    from: fromUser,
    to,
    subject,
    html,
  });
}

export function createEmailVerifyCode(): string {
  const code = Math.floor(Math.random() * 1000000)
  return code.toString().padStart(6, '0') 
}

type WechatAccessTokenInfo = {
  access_token: string
  expires_in: number
}

export async function refreshWechatAccessToken(entityManager: EntityManager) {
  const data = {
    grant_type: 'client_credential',
    appid: MLGB_CLIENT_ID,
    secret: process.env.MLGB_CLIENT_SECRET,
  }
  const requestUrl = 
  `${WECHAT_API_BASE}/cgi-bin/token?${qs.stringify(data)}`

  let tokenInfo: WechatAccessTokenInfo | null = null
  try {
    const resp: any = (await axios.get(requestUrl)).data
    if (resp && resp['access_token'] && resp['expires_in']) {
      tokenInfo = resp
    } else {
      console.error(`failed to refreshWechatAccessToken, resp: ${resp}`)
      return ''
    }
  } catch (err) {
    console.error(`failed to refreshWechatAccessToken: ${err}`)
    return ''
  }

  const { access_token: token, expires_in: expiresIn } = tokenInfo!
  const now = new Date()
  const expiresAt = new Date(now.getTime() + expiresIn * 1000)
  try {
    await entityManager.query(
      `INSERT INTO auth_wechat_accesstoken (client_id, token, expires_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $4)
      ON CONFLICT (client_id) DO UPDATE SET token = $2, expires_at = $3, updated_at = $4`,
      [MLGB_CLIENT_ID, token, expiresAt, now])
    return token
  } catch (err) {
    console.error(`failed to insert wechat access token: ${err}`)
    return ''
  }
}