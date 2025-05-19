import { readFileSync, writeFileSync } from "fs";
import { solTrGrpcWalletStart, solGrpcStop, solWalletGetBalance } from "dv-sol-lib"
import { trackerList } from "./detection";
import { config } from "./config";

const trackersFile = "trackers.json"
export let trackers: any

const jitotipAccounts = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5', // Jitotip 1
  'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe', // Jitotip 2
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY', // Jitotip 3
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49', // Jitotip 4
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh', // Jitotip 5
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt', // Jitotip 6
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL', // Jitotip 7
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT', // Jitotip 8
]

function readTracker() {
  const fdata = readFileSync(trackersFile, 'utf8')
  trackers = JSON.parse(fdata)
}

export function writeTracker() {
  writeFileSync(trackersFile, JSON.stringify(trackers, null, 2), 'utf8')
}

async function handleTracker(data: any, wathcingList: string[], record?: boolean) {
  if (!data || data.type !== "SolTransfer")
    return

  const from = data.from
  const to = data.to
  if (!wathcingList.includes(from))
    return

  if (jitotipAccounts.includes(to))
    return

  const curBalance = await solWalletGetBalance(from)
  const remainAfter = curBalance - data.amount
  console.log(`[Tracker](${from}) curBalance = ${curBalance}, remainAfter = ${remainAfter}`)
  if (remainAfter > 0.1 || (remainAfter < 0 && data.amount < 0.001))
    return
  console.log(`================== tracker changed (${from} -> ${to}`)

  solGrpcStop(from)
  solTrGrpcWalletStart([to], (data: any) => {
    handleTracker(data, wathcingList, record)
  })

  let idx
  if (record) {
    idx = trackers.findIndex((tr: any) => tr === from)
    if (idx !== -1)
    {
      trackers[idx] = to
      writeTracker()
    }
  }
  idx = trackerList.findIndex((t:string) => t === from)
  if (idx === -1)
    trackerList.push(to)
  else
    trackerList[idx] = to
}

export async function trackerTask() {
  readTracker()
  for (const tracker of trackers) {
    trackerList.push(tracker)
    solTrGrpcWalletStart([tracker], (data: any) => {
      handleTracker(data, trackers, true)
    })
  }

  const rootTrackers = config.makers
  solTrGrpcWalletStart(rootTrackers, (data: any) => {
    if (!data || data.type !== "SolTransfer")
      return
    if (!rootTrackers.includes(data.from))
      return
    if (data.amount < config.makerSupAmount[0] || data.amount > config.makerSupAmount[1])
      return
    console.log(`[** Special Maker **] ${data.from} to ${data.to}`)
    if (!config.makerEnable) {
      console.log(`!!!!!!! Maker sniper is disabled!`)
      return
    }
    solTrGrpcWalletStart([data.to], (sdata:any) => {
      handleTracker(sdata, [...rootTrackers, data.to])
    })
  })
}
