import { extractParsingData, getCurrentTimestamp, grpcPFProgramCallback, PumpfunBondInfo, sleep, SOL_ACCOUNT_RENT_FEE, solGrpcStart, solGrpcStop, solNonceCurrent, solNonceUpdate, solPFBuy, solPFCalcAmountOut, solPFCalcTokenAmount, solPFFetchPrice, solPFSell, solPfSwapSell, solTokenBalance, solTrGetBalanceChange, solTrGrpcPfCallback, solTrGrpcPfStart, solTrGrpcPumpSwapCallback, solTrSwapInspect, solWalletImport } from "dv-sol-lib";
import { TokenInfo } from "../types";
import { config } from "../config";
import { reportBought } from "../alert";
import { fetchMeta } from "../query";
import { TakeProfitManager } from "./takeProfit";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { tradeHistoryService } from "../db";

export const gSigner = solWalletImport(process.env.PRIVATE_KEY!)!
export let tradingCount = 0
let totalProfit = 0
const tradingTokens: Map<string, TokenInfo> = new Map()

export async function trade(tokenInfo: TokenInfo) {
  const token = tokenInfo.mint

  solNonceUpdate()
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

  console.log(`🚀 [${token}] Starting trade(creator: ${tokenInfo.creator})`)
  tradingTokens.set(token, tokenInfo)
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
        // config.trade.buyTip,
        {
          type: "0slot",
          amount: config.trade.buyTip
        },
        tokenInfo.initialPrice,
        tokenInfo.creator,
        config.trade.computeUnits,
        true
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
      tradingTokens.delete(token)
      return
    }

    investAmount = tx
  }
  tradeHistoryService.createTradeRecord({
    mint: token,
    name: tokenInfo.name,
    symbol: tokenInfo.symbol,
    creator: tokenInfo.creator,
    devBuy: tokenInfo.devBuy,
    txHash: tx,
  })
  if (config.trade.activeSale)
    await sell(token, Number(tokenBalance), investAmount, tokenInfo.creator, simulation)
  tradingTokens.delete(token)
  tradingCount--
}

async function sell(token: string, tokenBalance: number, investOrTx: number | string, creator: string, simulation: boolean = false) {
  let entryPrice
  let bcInfo: PumpfunBondInfo | undefined = undefined
  let investAmount: number = config.trade.amount
  let evPrice = 0
  let devSellPercent = 0
  let devSellTrigger = 0
  let migrationTrigger = 0

  function pumpfunTokenTrEvHandler(data: any) {
    if (!data)
      return
    switch (data.type) {
      case 'AddLiquidity': // migration to pumpswap
        migrationTrigger = config.trade.migrationSell
        const tInfo = tradingTokens.get(token)
        if (tInfo) {
          tInfo.migrated = true
        }
        break;
      case 'Trade':
        evPrice = data.price
        if (data.who === creator && data.how === 'sell') {
          const tokenInfo = tradingTokens.get(token)
          if (tokenInfo && tokenInfo.devBuy) {
            devSellPercent = (data.tokenAmount / tokenInfo.devAmount) * 100
            console.log(`+++++++++++++ dev sell! ${devSellPercent} %`)
            if (config.trade.devSell.enable && devSellPercent >= config.trade.devSell.triggerPercent) {
              devSellTrigger = config.trade.devSell.sellPercent
            }
          }
        }
        break;
      default:
        return
    }
  }

  function pumpswapTokenTrEvHandler(data: any) {
    if (!data)
      return
    if (data.type !== 'Trade')
      return
    evPrice = data.price * (10**3)
    if (data.how == 'sell' && data.who === creator) {
      const tokenInfo = tradingTokens.get(token)
      if (!tokenInfo)
        return
      devSellPercent = (data.tokenAmount / tokenInfo.devAmount) * 100
      console.log(`+++++++++++++ dev sell! ${devSellPercent} %`)
      if (config.trade.devSell.enable && devSellPercent >= config.trade.devSell.triggerPercent) {
        devSellTrigger = config.trade.devSell.sellPercent
      }
    }
  }

  solGrpcStart([token], (data: any) => {
    const tokenInfo = tradingTokens.get(token)
    if (!tokenInfo)
      return
    if (tokenInfo.migrated) {
      solTrGrpcPumpSwapCallback(data, pumpswapTokenTrEvHandler)
    } else {
      solTrGrpcPfCallback(data, pumpfunTokenTrEvHandler)
    }
  })

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
      .then((value: number) => investAmount = 0 - value)
  }

  while(!entryPrice) {
    entryPrice = await solPFFetchPrice(token)
    if (!entryPrice)
      await sleep(1000)
  }
  
  // sell
  const tpManager = new TakeProfitManager(token, entryPrice, config.trade.takeProfits)
  const startTm = getCurrentTimestamp()
  let priceResetTm = getCurrentTimestamp()
  let prePrice = 0
  let returnedAmount = 0
  const initialBalance = tokenBalance
  while (tokenBalance) {
    try {
      let sellTx = undefined
      const curTm = getCurrentTimestamp()
      const passedTime = (curTm - startTm) / 1000
      const curPrice = evPrice || await solPFFetchPrice(token)
      const percent = (curPrice / entryPrice) * 100
      if (prePrice !== curPrice) {
        prePrice = curPrice
        priceResetTm = getCurrentTimestamp()
        console.log(`[${token}] ------------- (${curPrice}/${entryPrice}) (${percent} %) passed: ${passedTime.toFixed(2)}, curReturned : ${returnedAmount}`)
      }
      const idleDuration = (getCurrentTimestamp() - priceResetTm) / 1000
      let sellPercent = tpManager.checkTakeProfits(token, curPrice, idleDuration)
      if (!sellPercent && devSellTrigger) {
        sellPercent = devSellTrigger
        devSellTrigger = 0
      }
      if (!sellPercent && migrationTrigger) {
        sellPercent = migrationTrigger
        migrationTrigger = 0
      }

      if (sellPercent) {
        let sellingTokenAmount = sellPercent >= 100 ? tokenBalance : initialBalance * sellPercent / 100
        sellingTokenAmount = Math.floor(sellingTokenAmount)
        if (sellingTokenAmount > tokenBalance || (tokenBalance - sellingTokenAmount) < 100000)
          sellingTokenAmount = tokenBalance
        console.log(`[${token}] Selling for ${sellingTokenAmount}`)
        if (simulation) {
          returnedAmount += await solPFCalcAmountOut(token, sellingTokenAmount, false)
          tokenBalance -= sellingTokenAmount
          sellTx = "simulate"
        } else {
          let sellRetry = 0
          while (sellRetry < config.trade.sellRetry) {
            const tokenInfo = tradingTokens.get(token)
            if (tokenInfo?.migrated) {
              sellTx = await solPfSwapSell(
                gSigner,
                token,
                sellingTokenAmount,
                config.trade.slippage, 
                {
                  type: "jito",
                  amount: config.trade.sellTip
                }
              )
            } else {
              sellTx = await solPFSell(
                gSigner,
                token,
                sellingTokenAmount,
                100,
                config.trade.prioFee,
                {
                  type: "jito",
                  amount: config.trade.sellTip
                },
                !curPrice ? bcInfo : undefined
              )
            }
            if (sellTx) {
              returnedAmount += await solTrGetBalanceChange(sellTx)
              break
            } else {
              sellRetry++
            }
          }
        }
      }
      if (sellTx) {
        priceResetTm = getCurrentTimestamp()
        tpManager.markupLevel(token, curPrice)
        tokenBalance = Number((await solTokenBalance(token, gSigner.publicKey))[0])
      }
    } catch (error) {
      // console.log(error)
    }
    await sleep(50)
  }

  solGrpcStop(token)
  const profit = returnedAmount - investAmount
  totalProfit += profit
  console.log(`[${token}] Trade finised! profit = ${profit}`)
  console.log(`💰 Total profit: ${totalProfit}`)
}