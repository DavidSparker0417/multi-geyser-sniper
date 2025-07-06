import { PF_PROGRAM_ID, shrdWalletMonitor, solTrGrpcPfStart } from "dv-sol-lib";
import { gSigner } from "./trade";

interface TokenTradeInfo {
  price: number
  buyerCount: number
  cumulativeSol: number
  aheadBuyers: number
  aheadSol: number
}
export const tokenPrice = new Map<string, TokenTradeInfo>();

// shrdWalletMonitor([PF_PROGRAM_ID.toBase58()], (data:any) => {
solTrGrpcPfStart((data:any) => {
  if (data.type !== 'Trade') 
    return
  // console.log(data)
  const token = data.what  
  if (data.who === gSigner.publicKey.toBase58()) {
    const tPrice = tokenPrice.get(token)
    if (tPrice) {
      tPrice.aheadBuyers = tPrice.buyerCount
      tPrice.aheadSol = tPrice.cumulativeSol
      tokenPrice.set(token, tPrice)
    }
    return
  }
  // console.log(data)
  const tPrice = tokenPrice.get(token)
  if (!tPrice) {
    tokenPrice.set(token, {
      price: data.price,
      buyerCount: data.how === 'buy' ? 1 : 0,
      aheadBuyers: 0,
      cumulativeSol: data.how === 'buy' ? data.solAmount : 0,
      aheadSol: 0,
    })
    setTimeout(() => {
      tokenPrice.delete(token)
    }, 1000 * 60 * 5)
  } else {
    tPrice.price = data.price
    tPrice.buyerCount += data.how === 'buy' ? 1 : -1
    tPrice.cumulativeSol += data.how === 'buy' ? data.solAmount : -data.solAmount
    tokenPrice.set(token, tPrice)
    // console.log(`[${token}] ########### price = ${data.price}, buyerCount = ${tPrice.buyerCount}`)
  }
}, [PF_PROGRAM_ID.toBase58()])

export function getTokenPrice(token: string): number {
  const tPrice = tokenPrice.get(token)
  if (!tPrice)
    return 0
  return tPrice.price
}

export function getTokenBuyerCount(token: string): number {
  const tPrice = tokenPrice.get(token)
  if (!tPrice)
    return 0
  return tPrice.aheadBuyers || tPrice.buyerCount
}

export function getTokenAheadSol(token: string): number {
  const tPrice = tokenPrice.get(token)
  if (!tPrice)
    return 0
  return tPrice.aheadSol || tPrice.cumulativeSol
}
