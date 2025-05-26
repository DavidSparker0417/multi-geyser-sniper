import { blxPumpNewMintStream, GrpcConfig, PF_MINT_AUTHORITY, PF_WALLET, solTrGrpcPfStart, solTrGrpcWalletStart, solWalletImport } from "dv-sol-lib";
import { detectionPf, suppliers } from "./detection";
import { config, loadGrpcConfig } from "./config";
import { trackerTask } from "./tracker";
import { access } from "fs";
import { url } from "inspector";

export const gSigner = solWalletImport(process.env.PRIVATE_KEY!)!

async function main() {
  try {
    console.log(`---------------------------------------`)
    console.log(`🤖 Starting TG bot with ${gSigner.publicKey.toBase58()} ...`)

    const grpcConf = loadGrpcConfig()
    console.table(grpcConf)

    // botStart()
    console.log(`---------------------------------------`)
    console.log(`👀 Starting monitor handlers ...`)
    for (let i = 0; i < grpcConf.length; i++) {
      solTrGrpcPfStart(
        (data: any) => {
          detectionPf(data, i)
        },
        [PF_MINT_AUTHORITY, PF_WALLET],
        grpcConf[i]
      )
    }

    // blxPumpNewMintStream(gSigner, (data: any) => {
    //   // console.table(data)
    //   detectionPf(data, grpcConf.length + 1)
    // })
    // solTrGrpcWalletStart(config.suppliers, onSupplierTr)
    // trackerTask()
  } catch (error: any) {
    console.error(`❌ Error : ${error.message}`)
  }
}

main()