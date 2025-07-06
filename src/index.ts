import { PF_MINT_AUTHORITY, PF_PROGRAM_ID, PF_WALLET, shrdWalletMonitor, shrederStart, solTrGrpcPfStart, solTrGrpcWalletStart, solWalletImport } from "dv-sol-lib";
import { detectionPf, suppliers } from "./detection";
import { gSigner } from "./trade";
import { config, loadGrpcConfig } from "./config";
import { trackerTask } from "./tracker";

async function onSupplierTr(data: any) {
  if (!data || data.type !== "SolTransfer")
    return

  if (data.amount < config.supplier.amount[0] || data.amount > config.supplier.amount[1])
    return

  if (suppliers.find((s: string) => s === data.to))
    return

  if (config.supplier.suppliers.find((s: string) => s === data.to))
    return

  console.log(`*************** adding ${data.to} to supplier ...`)
  suppliers.push(data.to)
}


async function main() {
  try {
    console.log(`---------------------------------------`)
    console.log(`🤖 Starting Sniper with ${gSigner.publicKey.toBase58()} ...`)

    trackerTask()
    solTrGrpcWalletStart(config.supplier.suppliers, onSupplierTr)

    shrdWalletMonitor([PF_MINT_AUTHORITY], (data:any) => {
      // console.log(data)
      detectionPf(data, 0)
    })

  } catch (error: any) {
    console.error(`❌ Error : ${error.message}`)
  }
}

main()