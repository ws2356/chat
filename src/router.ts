import express from 'express'
import { handleWechatEvent, healthCheck, getMessage } from './ctrls/chat'

const router = express.Router()
router.post('/', handleWechatEvent)
router.get('/health', healthCheck)
router.get('/api/message/:id', getMessage)

export = router
