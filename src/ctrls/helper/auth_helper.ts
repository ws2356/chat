import express from 'express'
import crypto from 'crypto'

export async function waitMs(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// TODO: use redis to share data between nodes
const ongoingRequestMap = new Map<string, boolean>()

export async function isGptRequestOngoing(chatMessageKey: string) {
  return ongoingRequestMap.get(chatMessageKey) || false
}

export async function setGptRequestOngoing(chatMessageKey: string, ongoing: boolean) {
  ongoingRequestMap.set(chatMessageKey, ongoing)
}

export function isCarMove(text: string) {
  return text.includes('挪车') ||
    text.includes('拖车') ||
    text.includes('挪一下') ||
    text.includes('动一下') ||
    text.includes('你的车') ||
    text.includes('你车')
}

export function verifyWechatSignature(req: express.Request, res: express.Response): boolean {
  const { signature, timestamp, nonce } = req.query || {}
  if (typeof signature !== 'string' || typeof timestamp !== 'string' || typeof nonce !== 'string') {
    console.error(`[${res.locals.reqId}] invalid signature query`)
    return false
  }
  const token = process.env.WECHAT_SIGNATURE_TOKEN
  if (!token) {
    console.error(`[${res.locals.reqId}] WECHAT_SIGNATURE_TOKEN not set`)
    return false
  }
  const sha1hash = crypto.createHash('sha1');
  sha1hash.update([token, timestamp, nonce].sort().join(''));
  const signatureToVerify = sha1hash.digest('hex');
  const ret = signatureToVerify === signature
  if (!ret) {
    console.error(`[${res.locals.reqId}] invalid signature: ${signatureToVerify} !== ${signature}`)
  }
  return ret
}