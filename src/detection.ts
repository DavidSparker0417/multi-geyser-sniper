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
import { fetchMeta } from './query';

export let buyCountsInMintBlock: any = {}
export const buyingAssets: any = {}
export const tradingTokens: any = {}
export const suppliers: string[] = []
export let trackerList: string[] = []
const tokenCache = new TokenCache()

async function handlePfMint(data: any) {
  const token = data.token
  const tokenInfo: TokenInfo = {
    mint: token,
    creator: data.creator,
    initialPrice: data.initialPrice,
    devBuy: data.initialBuy,
    devAmount: data.initialTokenAmount,
    mintBlock: data.block,
    migrated: false
  }
  fetchMeta(tokenInfo)
  if (config.devBuyBlacklist.includes(parseFloat(tokenInfo.devBuy.toFixed(3))))
    return
  if (tradingCount < 1 || config.whitelist.includes(tokenInfo.creator))
    trade(tokenInfo)
}

export function detectionPf(data: any, grpcId: number) {
  switch (data.type) {
    case 'Mint':
      const token = data.token
      if (tokenCache.has(token))
        break;
      tokenCache.add(token)
      reportDetectionTime(`(GRPC-${grpcId}) ${token}`, data.block, undefined, `(initialPrice = ${data.initialPrice}, devBuy = ${data.initialBuy})`)
      handlePfMint(data)
      break
    default:
      break
  }
}
