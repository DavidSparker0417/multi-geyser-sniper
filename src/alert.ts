import { solTrGetTimestamp } from "dv-sol-lib"

export async function reportBought(token: string, tx: string, startBlock: number) {
  const trTime = await solTrGetTimestamp(tx)
  if (!trTime)
    return
  console.log(`[${token}] +++++++++++++ bought after ${trTime.blockNumber - startBlock} blocks`)
}