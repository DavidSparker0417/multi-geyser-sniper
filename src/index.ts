import { PF_MINT_AUTHORITY, PF_PROGRAM_ID, PF_WALLET, shrdWalletMonitor, shrederStart, solTrGrpcPfStart, solTrGrpcWalletStart, solWalletImport } from "dv-sol-lib";
import { detectionPf } from "./detection";
import { gSigner } from "./trade";
import { loadGrpcConfig } from "./config";
import { trackerTask } from "./tracker";

async function main() {
  try {
    console.log(`---------------------------------------`)
    console.log(`🤖 Starting Sniper with ${gSigner.publicKey.toBase58()} ...`)

    trackerTask()

    shrdWalletMonitor([PF_MINT_AUTHORITY], (data:any) => {
      // console.log(data)
      detectionPf(data, 0)
    })

  } catch (error: any) {
    console.error(`❌ Error : ${error.message}`)
  }
}

main()