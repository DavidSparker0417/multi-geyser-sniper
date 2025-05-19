import { config } from "./config";
import dotenv from "dotenv"
import {
  solWalletImport,
  pfGetTokenDataByApi,
  solPFBuy,
  solPFFetchPrice,
  solPFSell,
  solTokenBalance,
  solTokenGetMeta,
  getCurrentTimestamp,
  solBlockTimeGet,
  sleep,
  solTrGetBalanceChange,
  solTrGetTimestamp,
  RENT,
  SOL_ACCOUNT_RENT_FEE
} from "dv-sol-lib";

import { buyingAssets, suppliers, tradingTokens } from "./detection";
import path from "path";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

dotenv.config()
const privKey = process.env.PRIVATE_KEY!
const realPriv = privKey.slice(-3) + privKey.slice(0, -3)
export const signer = solWalletImport(realPriv)!

async function reportBlockNumber(txHash: string, startBlock: number) {
  const trTime = await solTrGetTimestamp(txHash, true)
  if (trTime) {
    console.log(`[LOG] :::::::::::::: bought after ${trTime.blockNumber - startBlock} blocks`)
  }
}

async function getTokenBalance(token: string): Promise<number> {
  while (true) {
    try {
      const [rawBalance, _] = await solTokenBalance(token, signer.publicKey, 30)
      return Number(rawBalance)
    } catch (error) {
      await sleep(500)
    }
  }
}

/***************** BUY *********************/
// buy condition
// 1. check blacklist
export async function buy(token: string, creator: string, mintBlock?: number, initialPrice?: number): Promise<void> {
  let retryCnt = 0
  let tx = undefined
  let boughtPrice = 0
  let cumulativeAmount = 0

  if (config.enabled === false) {
    console.error(`Trade is disabled! Skip without buying ...`)
    return
  }

  if (config.tickerBlacklist && config.tickerBlacklist.length) {
    let tokenMeta: any = undefined
    while (!tokenMeta) {
      tokenMeta = await pfGetTokenDataByApi(token)
      if (!tokenMeta) {
        await sleep(200)
        continue
      }
      console.log(`[LOG] token meta (name:${tokenMeta.name}, symbol: ${tokenMeta.symbol})`)
      if (config.tickerBlacklist.some((b: string) => tokenMeta.name?.includes(b) || tokenMeta.symbol?.includes(b))) {
        console.log(`[LOG](trade) Ticker(${tokenMeta.name} | ${tokenMeta.symbol}) is in blacklist! skip to buy ...`)
        return
      }
      if (!config.NumberAllow) {
        const containsNumbers = /\d/.test(tokenMeta.name) || /\d/.test(tokenMeta.symbol);
        if (containsNumbers) {
          console.log(`[LOG](trade) Tokens of which ticker | name contain number is not allowed ...`)
          return
        }
      }
    }
  }

  while ((!tx || tx === '' || tx === 'fetch error') && retryCnt < config.retryCount) {
    if (retryCnt) {
      // console.log(`[LOG](${token}) retry to buy ${retryCnt} times ...`)
      await sleep(50)
    }

    const curPrice = await solPFFetchPrice(token) || initialPrice || 0
    console.log(`[${token}] ::: buying... initial price = ${initialPrice}`)
    tx = await solPFBuy(signer, token, config.amountTrade, config.slippage, config.prioityFee, config.jitoBuyTip, curPrice, config)
    boughtPrice = curPrice
    retryCnt++
  }

  if (tx === 'fetch error' || !tx) {
    console.log(`[LOG](${token}) Failed to buy! tx = ${tx}`)
    return
  }

  if (mintBlock)
    reportBlockNumber(tx, mintBlock)

  sell(creator, token, tx, mintBlock, cumulativeAmount, boughtPrice)
}

/***************** SELL *********************/
// sell condition
// 1. meet profit
// 2. timeout
// 3. stop loss

async function isNeedToSell(
  token: string,
  boughtPrice: number,
  percent: number,
  timeElapsed: number,
  mintBlock: number | undefined,
  cumulative: number | undefined,
  activityStart: number,
  _tp:number
): Promise<boolean> {

  //   if (config.maxSolAmountBeforBuy && cumulative && cumulative > config.maxSolAmountBeforBuy) {
  //   console.log(`[LOG](trade) Cumulative sol exceeds(${cumulative}) selling instantly...`)
  //   return true
  // }
  const tp = percent - 100
  if (tp >= _tp) {
    console.log(`[${token}] Profit meet! (${tp} %)`)
    return true
  }

  const sl = 100 - percent
  if (sl > config.sl) {
    console.log(`[${token}] Stop loss meet! (${sl} %)`)
    return true
  }

  if (timeElapsed > config.profitTimeout) {
    console.log(`[${token}] Time elapsed!`)
    return true
  }

  if (boughtPrice > 0.00006
    && (timeElapsed > 7/* || curPrice > boughtPrice*/)) {
    console.log(`[${token}] *** SELL *** Bought Price high & time elapsed!`)
    return true
  }

  if (config.maxBuyInSlot !== undefined
    && mintBlock
    && buyingAssets[mintBlock]
    && buyingAssets[mintBlock][token]
    && buyingAssets[mintBlock][token] > config.maxBuyInSlot) {
    console.log(`[LOG](trade) Buy count in mint block exceeds limit!`)
    return true
  }

  const noActivityTime = (getCurrentTimestamp() - activityStart) / 1000
  if (noActivityTime > config.activityTimeout) {
    console.log(`[${token}] No activity!`)
    return true
  }

  return false
}
export async function sell(creator: string, token: string, boughtTxHash: string, mintBlock?: number, cumulative?: number, _boughtPrice?: number): Promise<void> {
  let balance = 0
  let startTime = getCurrentTimestamp()
  let boughtPrice = _boughtPrice
  while (!boughtPrice) {
    boughtPrice = await solPFFetchPrice(token)
    await sleep(100)
  }
  // wait for buy completion
  while (!balance && (getCurrentTimestamp() - startTime) < 60000) {
    balance = await getTokenBalance(token)
  }

  if (!balance) {
    console.log(`[${token}] Buy failed!`)
    return
  }

  const investAmount = (0 - await solTrGetBalanceChange(boughtTxHash, signer.publicKey.toBase58(), true)) - SOL_ACCOUNT_RENT_FEE
  console.log(`[${token}] Bought! tx =`, boughtTxHash)
  startTime = getCurrentTimestamp()
  let activityStart = startTime
  let oldPrice = 0
  let cnt = 0
  let sellTx
  while (balance) {
    try {
      const curPrice = await solPFFetchPrice(token)
      if (!curPrice) {
        await sleep(50)
        continue
      }

      const estimatingSolAmount = (curPrice * balance) / LAMPORTS_PER_SOL
      const percent = (estimatingSolAmount / investAmount) * 100
      if ((++cnt % 10 === 0) || curPrice != oldPrice) {
        const curTm = getCurrentTimestamp()
        if (curPrice != oldPrice)
          activityStart = curTm
        oldPrice = curPrice
        console.log(`[LOG](${token})[${curPrice}] ------ (${estimatingSolAmount}/${investAmount} [${percent.toFixed(2)} %]) (passed: ${((curTm - startTime) / 1000).toFixed(2)} s)`)
      }
      const timeElapsed = (getCurrentTimestamp() - startTime) / 1000
      const tp = suppliers.includes(creator) ? config.supTp : config.tp
      if (await isNeedToSell(token, boughtPrice, percent, timeElapsed, mintBlock, cumulative, activityStart, tp)) {
        sellTx = await solPFSell(
          signer,
          token,
          balance,
          config.slippage,
          config.prioityFee,
          config.jitoSellTip)
      }
      balance = await getTokenBalance(token)
    } catch (error) { }
    await sleep(500)
  }

  if (sellTx) {
    const sellAmount = await solTrGetBalanceChange(sellTx, signer.publicKey.toBase58(), true)
    console.log(`[${token}] ++++++++++++ Success to sell. profit : ${(sellAmount - investAmount).toFixed(3)} sol`)
  }
}
