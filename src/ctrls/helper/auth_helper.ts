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