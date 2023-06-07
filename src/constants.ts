export const AUTH_TYPE_EMAIL = 1
export const AUTH_TYPE_MLGB = 3
export const AUTH_STATUS_OK = 1
export const AUTH_STATUS_PENDING = 2

const signupExpireMinutes = parseInt(process.env.SIGNUP_EXPIRE_MINUTES || '15') || 15
export const signupExpireMillis = signupExpireMinutes * 60 * 1000

export const WECHAT_API_BASE = 'https://api.weixin.qq.com'
export const MLGB_CLIENT_ID = 'wxb1262e2e56614d15'
export const MLGB_ACCESS_TOKEN_RESERVE_FRESH_MS = 300000 // 5 minutes
export const GPT_API_URL = 'https://r2d2.openai.azure.com/openai/deployments/gpt35Model/chat/completions?api-version=2023-03-15-preview'

export const GPT_SYSTEM_ROLE_INFO = {
  role: 'system',
  content: 'You are an AI assistant that helps people find information.'
}

export const GPT_REQUEST_TEMPLATE = {
  "messages": [],
  "max_tokens": 800,
  "temperature": 0.7,
  "frequency_penalty": 0,
  "presence_penalty": 0,
  "top_p": 0.95,
  "stop": null
}

