import { PF_WALLET, solTrGrpcPfStart } from "dv-sol-lib";
import { tradingTokens } from "./trade";

solTrGrpcPfStart((data:any) => {
  if (data.type !== 'AddLiquidity')
    return
  const token = data.token
  let tInfo = tradingTokens.get(token)
  if (!tInfo) {
    return
  }
  tInfo.migrated = true
  tradingTokens.set(token, tInfo)
  console.log(`[${token}] Migrated`)
}, [PF_WALLET])