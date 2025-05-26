import { sleep, solTokenGetMeta } from "dv-sol-lib"
import { DbTokenService } from "./db"
import { TokenInfo } from "./types"

export async function fetchMeta(tokenInfo: TokenInfo) {
  let tokenMeta
  let retryCnt = 0

  const token = tokenInfo.mint
  console.time(`[${token}] Fetching meta`)
  while(retryCnt < 50) {
    try {
      tokenMeta = await solTokenGetMeta(token) 
      if (tokenMeta)
        break
    } catch (error) {}
    retryCnt ++
    // console.log(`[${token}] fetching meta retry(${retryCnt})`)
    await sleep(300)
  }
  console.timeEnd(`[${token}] Fetching meta`)
  if (!tokenMeta) {
    console.error(`[${token}] Cannot get the token meta info`)
    return
  }
  console.table(tokenMeta)
  const dbToken = new DbTokenService()
  await dbToken.connect()
  await dbToken.createToken({
    mint: tokenMeta.address!,
    symbol: tokenMeta.symbol,
    name: tokenMeta.name,
    creator: tokenInfo.creator,
    twitter: tokenMeta.twitter?.toString() || "",
    telegram: tokenMeta.telegram?.toString() || "",
    website: tokenMeta.website?.toString() || "",
    createdAt: new Date()
  })
}
