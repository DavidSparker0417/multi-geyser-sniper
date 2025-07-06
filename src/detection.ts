import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58'
import { PF_CMD_BUY, PF_CMD_SELL, PF_FEE_RECIPIENT, PF_MINT_AUTHORITY, PF_PROGRAM_ID, pfGetTokenDataByApi, reportDetectionTime, solTokenGetMeta, solTrIsPumpfunBuy } from 'dv-sol-lib';
import { config } from './config';
import { bytesToUInt64, getCurrentTimestamp, sleep } from 'dv-sol-lib';
import { solBlockTimeGet } from 'dv-sol-lib';
import { confirmedConnection } from 'dv-sol-lib';
import * as net from "net"
import { server } from 'typescript';
import { trackers } from './tracker';
import { TokenCache } from './cache';
import { TokenInfo } from './types';
import { trade } from './trade';
import { tradingCount } from './trade';
import { tradeHistoryService } from './db';
import { penaltyHas, penaltyList } from './trade/penalty';

export let buyCountsInMintBlock: any = {}
export const buyingAssets: any = {}
export const suppliers: string[] = []
export let trackerList: string[] = []
const tokenCache = new TokenCache()

async function filterTrade(tokenInfo: TokenInfo): Promise<boolean> {
  // console.log(`penaltyList :`, penaltyList.entries())
  if (config.penalty.enabled && penaltyHas(tokenInfo.creator)) {
    console.error(`[${tokenInfo.mint}] Token rejected: Creator(${tokenInfo.creator}) in penalty list`)
    return false
  }

  // if (tokenInfo.devBuy > 0 && tokenInfo.devBuy < 1)
  //   return true

  if (trackerList.includes(tokenInfo.creator)) {
    console.log(`[${tokenInfo.mint}] Tracker: ${tokenInfo.creator} !!`)
    return true
  }

  if (config.supplier.enabled && suppliers.includes(tokenInfo.creator)) {
    console.log(`[${tokenInfo.mint}] Supplier: ${tokenInfo.creator} !!`)
    return true
  }

  if (!config.whitelist.includes(tokenInfo.creator)) {
    // console.log(`[filterTrade] Token ${tokenInfo.mint} rejected: Creator not in whitelist`)
    return false
  }

  if (config.devBuyBlacklist.includes(Number(tokenInfo.devBuy.toFixed(2)))) {
    console.error(`[${tokenInfo.mint}] Token rejected: Dev buy amount ${tokenInfo.devBuy} in blacklist`)
    return false
  }

  if (tokenInfo.initialPrice > 0.0005) {
    console.error(`[${tokenInfo.mint}] Token rejected: Initial price ${tokenInfo.initialPrice}`)
    return false
  }

  // if ((await tradeHistoryService.getTradeHistoryByName(tokenInfo.name)).length > 0) {
  //   console.error(`[${tokenInfo.mint}] Token (${tokenInfo.name}) rejected: Trade history exists`)
  //   return false
  // }

  // if ((await tradeHistoryService.getTradeHistoryBySymbol(tokenInfo.symbol)).length > 0) {
  //   console.error(`[${tokenInfo.mint}] Token (${tokenInfo.symbol}) rejected: Trade history exists`)
  //   return false
  // }
  // if (tradingCount > 0) {
    //  console.log(`[filterTrade] Token ${tokenInfo.mint} rejected: Trading count > 0 (${tradingCount})`)
    // return false
  // }
  // console.log(`[filterTrade] Token ${tokenInfo.mint} accepted for trading`)
  return true
}

async function handlePfMint(data: any) {
  const token = data.token
  const tokenInfo: TokenInfo = {
    mint: token,
    creator: data.creator,
    name: data.name,
    symbol: data.symbol,
    initialPrice: data.initialPrice,
    devBuy: data.initialBuy,
    devAmount: data.initialTokenAmount,
    mintBlock: data.block,
    migrated: false
  }
  const initialLiq = data.initialLiq
  // if (initialLiq < config.liquidityRange[0] || initialLiq > config.liquidityRange[1])
  //   return
  if (await filterTrade(tokenInfo)) {
    console.table(tokenInfo)
    trade(tokenInfo)
  }
}

export function detectionPf(data: any, grpcId: number) {
  switch (data.type) {
    case 'Mint':
      const token = data.token
      if (tokenCache.has(token)) {
        // console.log(`(GRPC-${grpcId}) ${token} rejected: Token already in cache`)
        break;
      }
      tokenCache.add(token)
      reportDetectionTime(`(GRPC-${grpcId}) ${token}`, data.block, undefined, `(initialPrice = ${data.initialPrice}, devBuy = ${data.initialBuy})`)
      handlePfMint(data)
      break
    default:
      break
  }
}
