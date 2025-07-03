import { config } from "../config"

export const penaltyList: Set<string> = new Set()

export function penaltyAdd(creator: string) {
  if (!config.penalty.enabled) {
    return
  }
  if (penaltyList.has(creator)) {
    return
  }
  // console.log(`[${creator}] penalty added`)
  penaltyList.add(creator)
  setTimeout(() => {
    penaltyList.delete(creator)
  }, 1000 * 60 * config.penalty.time)
}

export function penaltyRemove(creator: string) {
  penaltyList.delete(creator)
}

export function penaltyHas(creator: string) {
  return penaltyList.has(creator)
}