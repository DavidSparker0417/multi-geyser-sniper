import { getCurrentTimestamp, PumpfunBondInfo, sleep, SOL_ACCOUNT_RENT_FEE, solNonceCurrent, solNonceUpdate, solPFBuy, solPFCalcAmountOut, solPFCalcTokenAmount, solPFFetchPrice, solPFSell, solTokenBalance, solTrGetBalanceChange, solTrSwapInspect } from "dv-sol-lib";
import { TokenInfo } from "../types";
import { config } from "../config";
import { reportBought } from "../alert";
import { fetchMeta } from "../query";
import { gSigner } from "..";
import { TakeProfitManager } from "./takeProfit";
import { PublicKey } from "@solana/web3.js";

export let tradingCount = 0
let totalProfit = 0

export async function trade(tokenInfo: TokenInfo) {
  const token = tokenInfo.mint

  if (!config.trade.enabled) {
    console.log(`[${token}] Trade is disabled. skipping ...`)
    return;
  }

  // Validate token mint address
  try {
    new PublicKey(token);
  } catch (error) {
    console.log(`❌ [${token}] Invalid token mint address`);
    return;
  }

  console.log(`🚀 [${token}] Starting trade`)
  // fetchMeta(tokenInfo)
  // buy
  let tx
  tradingCount++
  let tokenBalance = 0
  let investAmount
  const simulation = config.trade.simulation
  if (config.trade.simulation) {
    while (true) {
      try {
        tokenBalance = Number(await solPFCalcAmountOut(token, config.trade.amount, true))
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
    // while (retryCnt < 10) {
    try {
      tx = await solPFBuy(
        gSigner,
        token,
        config.trade.amount,
        config.trade.slippage,
        config.trade.prioFee,
        config.trade.buyTip,
        // {
        //   type: "astralane",
        //   amount: config.trade.buyTip
        // },
        tokenInfo.initialPrice,
        tokenInfo.creator
      )

      console.log(`[${token}] +++++++++++ bought tx :`, tx)
      if (tx) {
        reportBought(token, tx, tokenInfo.mintBlock)
      } else {
        console.log(`❌ [${token}] Failed to buy token with amount ${config.trade.amount} SOL`)
        retryCnt++
        solNonceUpdate()
        // await sleep(500)
      }
    } catch (error: any) {
      console.log(`❌ [${token}] Buy error:`, error.message)
      if (error.logs) {
        console.log(`[${token}] Transaction logs:`, error.logs)
      }
      retryCnt++
      // await sleep(500)
    }
    // }
    if (!tx) {
      tradingCount--
      return
    }

    investAmount = tx
  }
  await sell(token, Number(tokenBalance), investAmount, tokenInfo.creator, simulation)
  tradingCount--
}

function isNeedToSell(token: string, timePassed: number, percent: number, idleDuration: number): number {
  if (timePassed > config.trade.timeout) {
    console.log(`⏰ [${token}] Timeout reached!`)
    return 100;
  }
  if (!percent)
    return 0
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

async function sell(token: string, tokenBalance: number, investOrTx: number | string, creator: string, simulation: boolean = false) {
  let entryPrice
  const tpManager = new TakeProfitManager()
  let bcInfo: PumpfunBondInfo|undefined = undefined
  let investAmount: number = config.trade.amount
  if (typeof investOrTx === 'number') {
    entryPrice = await solPFFetchPrice(token)
    investAmount = investOrTx
  }
  else {
    const boughtInf: any = await solTrSwapInspect(investOrTx, "PumpFun")
    // console.table(boughtInf)
    tokenBalance = Number(boughtInf?.tokenAmount) || Number((await solTokenBalance(token, gSigner.publicKey, 30))[0])
    entryPrice = boughtInf?.price || await solPFFetchPrice(token)
    bcInfo = boughtInf?.bcInfo
    solTrGetBalanceChange(investOrTx, undefined, true)
      .then((value: number) => investAmount = value)
  }
  // sell
  tpManager.initializeToken(token, entryPrice, config.trade.takeProfits)
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
            config.trade.sellTip,
            !curPrice ? bcInfo : undefined
          )
          if (sellTx) {
            returnedAmount += await solTrGetBalanceChange(sellTx)
          }
        }
        priceResetTm = getCurrentTimestamp()
      }
      if (!simulation) {
        tokenBalance = Number((await solTokenBalance(token, gSigner.publicKey))[0])
        console.log(`curTokenBalance =`, tokenBalance)
      }
    } catch (error) {
      // console.log(error)
    }
    await sleep(500)
  }

  const profit = returnedAmount - investAmount
  totalProfit += profit
  console.log(`[${token}] Trade finised! profit = ${profit}`)
  console.log(`💰 Total profit: ${totalProfit}`)
}