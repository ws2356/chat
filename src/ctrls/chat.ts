import express from 'express'
import { Readable } from 'stream'
import axios from 'axios'
import _ from 'lodash'
import * as xml2js from 'xml2js'
import { getChatMessageRepo, dataSource, getChatReplyRepo } from '../db'
import { ChatMessage } from '../entity/chat_message'
import { waitMs } from './helper/auth_helper'
import { AUTH_TYPE_MLGB, GPT_API_URL, GPT_REQUEST_TEMPLATE, GPT_SYSTEM_ROLE_INFO, GPT_REQUEST_LOAD_TIMEOUT_MS } from '../constants'
import { ChatReply } from '../entity/chat_reply'


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

async function sendReply(res: express.Response, wechatEvent: WechatEvent, replyContent: string) {
  const replyMessage = {
    ToUserName: wechatEvent.FromUserName,
    FromUserName: wechatEvent.ToUserName,
    CreateTime: Math.floor(Date.now() / 1000),
    MsgType: wechatEvent.MsgType,
    Content: replyContent,
  }
  const replyXml = new xml2js.Builder().buildObject({ xml: replyMessage })
  try {
    await sendResult(res, 200, replyXml)
  } catch (error) {
    console.error(`[${res.locals.reqId}] sendReply fail: ${error}`)
  }
}

function isReplyValid(reply: ChatReply): boolean {
  return reply.loadStatus === 1 && !_.isEmpty(reply.reply)
}

async function markReplyAsReplied(id: number, reply: Partial<ChatReply>) {
  try {
    await getChatReplyRepo().update(id, { ...reply, replied: true })
  } catch (error) {
    console.error(`markReplyAsReplied error: ${error}`)
  }
}

type WechatEvent = {
  ToUserName: string,
  FromUserName: string,
  CreateTime: string,
  MsgType: string,
  Content: string,
  MsgId: string,
}

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

  const chatMessage = await dataSource.transaction(async (manager) => {
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
        return chatMessage
      }

      const now = new Date()
      const ret = await getChatMessageRepo(manager).save({
        authType: AUTH_TYPE_MLGB,
        authId: FromUserName,
        msgId: MsgId,
        msgType: MsgType,
        content: Content,
        toUserName: ToUserName,
        createTime: new Date(parseInt(CreateTime) * 1000),
      })
      const reply = await getChatReplyRepo(manager).save({
        loadStatus: 4,
        createdAt: now,
        chatMessage: ret,
      })
      ret.replies = [reply]
      return ret
    } catch (error) {
      console.error(`[${res.locals.reqId}] find or create fail: ${error}`)
      // Assuming duplicate key error
      return null
    }
  })

  if (!chatMessage) {
    res.status(500).send('server fail')
    return
  }

  const validReply = chatMessage.replies.find((reply) => isReplyValid(reply))
  const newReply = chatMessage.replies.find((reply) => reply.loadStatus === 4)

  if (newReply) {
    const markReplyPending = (async () => {
      if (!newReply) {
        return
      }
      newReply.loadStatus = 2
      try {
        await getChatReplyRepo().update(newReply.id, newReply)
      } catch (error) {
        console.error(`[${res.locals.reqId}] markReplyPending error: ${error}`)
      }
    })()

    const gptRequestBody = {
      ...GPT_REQUEST_TEMPLATE,
      messages: [
        GPT_SYSTEM_ROLE_INFO,
        { role: 'user', content: Content }
      ]
    }

    let replyContent = ''
    try {
      const timerLabel = `[${res.locals.reqId}] start request gpt`
      console.time(timerLabel)
      console.log(timerLabel)
      const gptResp = await axios.post(
        GPT_API_URL,
        gptRequestBody,
        {
          headers: {
            'api-key': `${process.env.GPT_API_KEY}`,
            'Content-Type': 'application/json'
          }
        })
      console.timeEnd(timerLabel)

      const gptRespData = gptResp.data
      const { content } = _.get(gptRespData, ['choices', 0, 'message'], {})
      replyContent = content || ''

      if (gptResp.status !== 200 || !replyContent) {
        console.error(`[${res.locals.reqId}] gpt api fail: ${gptResp.status}, ${JSON.stringify(gptResp.data, null, 4)}`)
        res.status(500).send('server fail')
        return
      }
    } catch (error) {
      console.error(`[${res.locals.reqId}] gpt request fail: ${error}`)
      res.status(500).send('server fail')
      await getChatReplyRepo().update({ id: newReply.id }, { loadStatus: 3 })
      return
    }

    await sendReply(
      res,
      {
        ToUserName,
        FromUserName,
        CreateTime,
        MsgType,
        Content,
        MsgId,
      },
      replyContent
    )
    await markReplyPending.then(
      async () => markReplyAsReplied(
        newReply.id, { reply: replyContent, loadStatus: 1, loadedAt: new Date() })
    )
  } else if (validReply) {
      await sendReply(
        res,
        {
          ToUserName,
          FromUserName,
          CreateTime,
          MsgType,
          Content,
          MsgId,
        },
        validReply.reply!
      )
    if (!validReply.replied) {
      await markReplyAsReplied(validReply.id, { replied: true })
    }
  } else {
    // polls reply
    let validReply: ChatReply | undefined
    for (let i = 0; i < 5; ++i) {
      await waitMs(1000)
      const newChatMessage = await getChatMessageRepo().findOne({
        where: { id: chatMessage.id },
      })
      if (!newChatMessage) {
        continue
      }
      validReply = newChatMessage.replies.find((reply) => isReplyValid(reply))
      if (validReply) {
        break
      }
    }

    if (!validReply) {
      console.error('replyContent not found')
      res.status(500).send('server fail')
      return
    }

    await sendReply(
      res,
      {
        ToUserName,
        FromUserName,
        CreateTime,
        MsgType,
        Content,
        MsgId,
      },
      validReply.reply!
    )

    if (!validReply.replied) {
      await markReplyAsReplied(validReply.id, { replied: true })
    }
  }
}
