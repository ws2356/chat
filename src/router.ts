import express from 'express'
import { handleWechatEvent, healthCheck } from './ctrls/chat'

const router = express.Router()
router.post('/', handleWechatEvent)
router.get('/health', healthCheck)

export = router
