
import { sleep } from "dv-sol-lib"
import * as fs from 'fs';

interface Config {
  enabled: boolean,
  ctEnable: boolean,
  amountTrade: number,
  slippage: number,
  tp: number,
  sl: number,
  activityTimeout: number,
  profitTimeout: number,
  cumulativeSol: number,
  minLUTCount: number,
  prioityFee: number,
  retryCount: number,
  jitoBuyTip: number,
  jitoSellTip: number,
  devBuyMin: number,
  devBuyMax: number,
  maxBuyInSlot: number,
  maxSolAmountBeforBuy: number,
  cumulativeBlacklist: number[],
  initialBuyBlackList: number[],
  initialBuyWhiteList: number[],
  maxTxCountInMintBlock: number,
  tickerBlacklist: string[],
  NumberAllow: boolean,
  whitelist: string[],
  goodMakers: string[],
  suppliers: string[],
  supTp: number,
  supAmount: number[],
  supEnable: boolean,
  makers: string[],
  makerSupAmount: number[],
  makerEnable: boolean
}

export let config: Config

async function loadConfig() {
  while (true) {
    try {
      const fdata = fs.readFileSync('config.json', 'utf8')
      config = JSON.parse(fdata)
      // console.log(config.priceMonitor)
      await sleep(5000)
    } catch (error) { }
  }
}

loadConfig()
