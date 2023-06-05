export const AUTH_TYPE_EMAIL = 1
export const AUTH_TYPE_MLGB = 3
export const AUTH_STATUS_OK = 1
export const AUTH_STATUS_PENDING = 2

const signupExpireMinutes = parseInt(process.env.SIGNUP_EXPIRE_MINUTES || '15') || 15
export const signupExpireMillis = signupExpireMinutes * 60 * 1000

export const WECHAT_API_BASE = 'https://api.weixin.qq.com'
export const MLGB_CLIENT_ID = 'wxb1262e2e56614d15'
export const MLGB_ACCESS_TOKEN_RESERVE_FRESH_MS = 300000 // 5 minutes