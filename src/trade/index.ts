import { getCurrentTimestamp, sleep, SOL_ACCOUNT_RENT_FEE, solNonceCurrent, solPFBuy, solPFCalcAmountOut, solPFCalcTokenAmount, solPFFetchPrice, solPFSell, solTokenBalance, solTrGetBalanceChange } from "dv-sol-lib";
import { TokenInfo } from "../types";
import { config } from "../config";
import { reportBought } from "../alert";
import { fetchMeta } from "../query";
import { gSigner } from "..";
import { TakeProfitManager } from "./takeProfit";

export let tradingCount = 0
let totalProfit = 0

export async function trade(tokenInfo: TokenInfo) {
  const token = tokenInfo.mint

  if (!config.trade.enabled) {
    console.log(`[${token}] Trade is disabled. skipping ...`)
    return;
  }

  console.log(`🚀 [${token}] Starting trade`)
  fetchMeta(tokenInfo)
  // buy
  tradingCount++
  let tokenBalance, investAmount
  const simulation = config.trade.simulation
  if (config.trade.simulation) {
    while (true) {
      try {
        tokenBalance = await solPFCalcAmountOut(token, config.trade.amount, true)
        if (tokenBalance) {
          tokenBalance *= 10 ** 6
          break
        }
      } catch (error) { }
      await sleep(1000)
    }
    console.log(`[SIMULATION] tokenBalance =`, tokenBalance)
    investAmount = config.trade.amount
  }
  else {
    let retryCnt = 0
    let tx
    // while (retryCnt < 3) {
    tx = await solPFBuy(
      gSigner,
      token,
      config.trade.amount,
      config.trade.slippage,
      config.trade.prioFee,
      {
        type: "jito",
        amount: config.trade.buyTip,
      },
      tokenInfo.initialPrice,
      tokenInfo.creator
    )
    if (tx) {
      reportBought(token, tx, tokenInfo.mintBlock)
      // break
    } else {
      console.log(`❌ [${token}] Failed to buy token with amount ${config.trade.amount} SOL`)
      retryCnt++
    }
    // continue
    // }

    if (!tx) {
      tradingCount--
      return
    }

    // wait for buy confirmation
    tokenBalance = (await solTokenBalance(token, gSigner.publicKey, 30))[0]
    if (!tokenBalance) {
      console.log(`[${token}] Failed to buy!`)
      tradingCount--
      return
    }

    investAmount = 0 - (await solTrGetBalanceChange(tx, undefined, true))
    if (investAmount)
      investAmount -= SOL_ACCOUNT_RENT_FEE
    else
      investAmount = config.trade.amount
  }
  await sell(token, Number(tokenBalance), investAmount, simulation)
  tradingCount--
}

function isNeedToSell(token: string, timePassed: number, percent: number, idleDuration: number): number {
  if (timePassed > config.trade.timeout) {
    console.log(`⏰ [${token}] Timeout reached!`)
    return 100;
  }
  if (percent - 100 > config.trade.tp) {
    console.log(`🎯 [${token}] TP reached! (${percent}%)`)
    return 100;
  }
  if (100 - percent > config.trade.sl) {
    console.log(`💔 [${token}] SL reached! (${percent}%)`)
    return 100;
  }
  if (config.trade.idleSell.enabled && idleDuration > config.trade.idleSell.idleTime) {
    console.log(`😴 [${token}] Idle sell triggered! (${idleDuration.toFixed(2)}s)`)
    return config.trade.idleSell.sellPercentage
  }

  return 0;
}

async function sell(token: string, tokenBalance: number, investAmount: number, simulation: boolean = false) {
  const entryPrice = await solPFFetchPrice(token)
  const tpManager = new TakeProfitManager()
  tpManager.initializeToken(token, entryPrice, config.trade.takeProfits)
  // sell
  const startTm = getCurrentTimestamp()
  let priceResetTm = getCurrentTimestamp()
  let sellTx
  let prePrice = 0
  let returnedAmount = 0
  const initialBalance = tokenBalance
  while (tokenBalance) {
    try {
      const curTm = getCurrentTimestamp()
      const passedTime = (curTm - startTm) / 1000
      const curPrice = await solPFFetchPrice(token)
      const percent = (curPrice / entryPrice) * 100
      if (prePrice !== curPrice) {
        prePrice = curPrice
        priceResetTm = getCurrentTimestamp()
      }
      const idleDuration = (getCurrentTimestamp() - priceResetTm) / 1000
      console.log(`[${token}] ------------- (${curPrice}/${entryPrice}) (${percent} %) passed: ${passedTime.toFixed(2)}, curReturned : ${returnedAmount}`)
      const sellPercent = isNeedToSell(token, passedTime, percent, idleDuration)
      if (sellPercent) {
        let sellingTokenAmount = sellPercent >= 100 ? tokenBalance : initialBalance * sellPercent / 100
        sellingTokenAmount = Math.floor(sellingTokenAmount)
        if (sellingTokenAmount > tokenBalance)
          sellingTokenAmount = tokenBalance
        console.log(`[${token}] Selling for ${sellingTokenAmount}`)
        if (simulation) {
          returnedAmount += await solPFCalcAmountOut(token, sellingTokenAmount, false)
          tokenBalance -= sellingTokenAmount
        } else {
          sellTx = await solPFSell(
            gSigner,
            token,
            sellingTokenAmount,
            100,
            config.trade.prioFee,
            config.trade.sellTip
          )
          if (sellTx) {
            returnedAmount += await solTrGetBalanceChange(sellTx)
          }
        }
        priceResetTm = getCurrentTimestamp()
      }
      if (!simulation)
        tokenBalance = Number((await solTokenBalance(token, gSigner.publicKey))[0])
    } catch (error) {
      console.log(error)
    }
    await sleep(1000)
  }

  const profit = returnedAmount - investAmount
  totalProfit += profit
  console.log(`[${token}] Trade finised! profit = ${profit}`)
  console.log(`💰 Total profit: ${totalProfit}`)
}