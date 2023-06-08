import express from 'express'
import { Readable } from 'stream'
import axios from 'axios'
import _, { get } from 'lodash'
import * as xml2js from 'xml2js'
import { getChatMessageRepo, dataSource, getChatReplyRepo } from '../db'
import { ChatMessage } from '../entity/chat_message'
import { waitMs } from './helper/auth_helper'
import { AUTH_TYPE_MLGB, GPT_API_URL, GPT_REQUEST_TEMPLATE, GPT_SYSTEM_ROLE_INFO, GPT_REQUEST_LOAD_TIMEOUT_MS } from '../constants'


async function sendResult(res: express.Response, status: number, result: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const readable = Readable.from(result)
    readable.on('error', (error) => {
      console.error(`sendResult error: ${error}`)
      res.end()
      reject(error)
    })
    readable.on('end', () => {
      resolve()
    })
    readable.pipe(res.status(status))
  })
}

export async function healthCheck(req: express.Request, res: express.Response) {
  res.type('application/xml')
  try {
    await sendResult(res, 200, 'success')
    console.log('healthCheck ok')
  } catch (error) {
    console.error(`healthCheck error: ${error}`)
  }
}

const UNEXPECTED_INSERT_ERROR = new Error('insert fail unexpected')
export async function handleWechatEvent(req: express.Request, res: express.Response) {
  res.type('application/xml')

  const data: any = req.body || {}
  const {
    tousername: ToUserName,
    fromusername: FromUserName,
    createtime: CreateTime,
    msgtype: MsgType,
    content: Content,
    msgid: MsgId } = _.mapValues(data.xml, (v: any) => v && v[0])

  if (typeof MsgId !== 'string' ||
    typeof MsgType !== 'string' ||
    typeof Content !== 'string' ||
    typeof ToUserName !== 'string' ||
    typeof FromUserName !== 'string' ||
    typeof CreateTime !== 'string') {
    console.error(`bad arg: ${JSON.stringify(data, null, 4)}`)
    res.status(400).send('bad arg')
    return
  }

  if (!Content) {
    res.status(200).send('success')
    return
  }

  const [chatMessage, isCreated] = await dataSource.transaction(async (manager) => {
    const now = new Date()
    try {
      const chatMessage = await getChatMessageRepo(manager).findOne({
        where: {
          authType: AUTH_TYPE_MLGB,
          authId: FromUserName,
          msgId: MsgId,
          msgType: MsgType,
        }
      })
      if (chatMessage) {
        return [chatMessage, false]
      }
      const insertMessageRes = await getChatMessageRepo(manager).insert({
        authType: AUTH_TYPE_MLGB,
        authId: FromUserName,
        msgId: MsgId,
        msgType: MsgType,
        content: Content,
        toUserName: ToUserName,
        createTime: new Date(parseInt(CreateTime) * 1000),
      })
      if (insertMessageRes.identifiers.length !== 1) {
        // TODO: remove debug code - should not throw error here
        throw UNEXPECTED_INSERT_ERROR
      }

      const insertReplyRes = await getChatReplyRepo(manager).insert({
        loadStatus: 2,
        createdAt: now,
      })
      if (insertReplyRes.identifiers.length !== 1) {
        // TODO: remove debug code - should not throw error here
        throw UNEXPECTED_INSERT_ERROR
      }

      await getChatMessageRepo(manager).update(
        { id: insertMessageRes.identifiers[0].id },
        { reply: insertReplyRes.identifiers[0] }
      )

      return getChatMessageRepo(manager).findOne({
        where: {
          id: insertMessageRes.identifiers[0].id,
        },
      })
      .then((chatMessage: ChatMessage | null) => [chatMessage, true])
    } catch (error) {
      console.error(`db query fail: ${error}`)
      // Assuming duplicate key error
      return [null, false]
    }
  })

  if (!chatMessage) {
    console.error('chatMessage not found or created')
    res.status(500).send('server fail')
    return
  }

  // TODO: handle retry
  const isLoadingTimeout = chatMessage.reply.loadStatus === 2 &&
    (new Date().getTime() - chatMessage.reply.createdAt.getTime()) > GPT_REQUEST_LOAD_TIMEOUT_MS

  let replyContent = ''
  if (chatMessage.reply.loadStatus === 3 || isCreated || isLoadingTimeout) {
    const gptRequestBody = {
      ...GPT_REQUEST_TEMPLATE,
      messages: [
        GPT_SYSTEM_ROLE_INFO,
        { role: 'user', content: Content }
      ]
    }
    try {
      const gptResp = await axios.post(
        GPT_API_URL,
        gptRequestBody,
        {
          headers: {
            'api-key': `${process.env.GPT_API_KEY}`,
            'Content-Type': 'application/json'
          }
        })
      if (gptResp.status !== 200) {
        console.error(`gpt api fail: ${gptResp.status}, ${JSON.stringify(gptResp.data, null, 4)}`)
        res.status(500).send('server fail')
        return
      }
      const gptRespData = gptResp.data
      const { content } = _.get(gptRespData, ['choices', 0, 'message'], {})
      replyContent = content || ''
      await getChatReplyRepo().update({ id: chatMessage.reply.id }, { reply: content || '', loadStatus: 1, loadedAt: new Date() })
    } catch (error) {
      console.error(`db query fail: ${error}`)
      res.status(500).send('server fail')
      await getChatReplyRepo().update({ id: chatMessage.reply.id }, { loadStatus: 3 })
      return
    }
  } else {
    // polls reply
    for (let i = 0; i < 5; ++i) {
      await waitMs(1000)
      const chatReply = await getChatReplyRepo().findOne({ where: { id: chatMessage.reply.id } })
      if (chatReply?.loadStatus === 1) {
        replyContent = chatReply.reply || ''
        break
      }
    }

    if (!replyContent) {
      console.error('replyContent not found')
      res.status(500).send('server fail')
      return
    }
  }

  const replyMessage = {
    ToUserName: FromUserName,
    FromUserName: ToUserName,
    CreateTime: Math.floor(Date.now() / 1000),
    MsgType,
    Content: replyContent,
  }
  const replyXml = new xml2js.Builder().buildObject({ xml: replyMessage })

  try {
    await sendResult(res, 200, replyXml)
  } catch (error) {
    // no need to call res.send again, because sendResult already call res.send on success and res.end on error
    console.error(`sendResult fail: ${error}`)
  }

  try {
    await getChatReplyRepo().update({ id: chatMessage.reply.id }, { replied: true })
  } catch (error) {
    console.error(`update replied = true fail: ${error}`)
  }
}
