import express from 'express'
import { handleWechatEvent, healthCheck, getMessageById } from './ctrls/chat'

const router = express.Router()
router.post('/', handleWechatEvent)
router.get('/api/message/:id', getMessageById)
router.get('/health', healthCheck)

export = router
