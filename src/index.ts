import { PF_MINT_AUTHORITY, PF_WALLET, solTrGrpcPfStart, solWalletImport } from "dv-sol-lib";
import { detectionPf } from "./detection";
import { loadGrpcConfig } from "./config";

export const gSigner = solWalletImport(process.env.PRIVATE_KEY!)!

async function main() {
  try {
    console.log(`---------------------------------------`)
    console.log(`🤖 Starting TG bot with ${gSigner.publicKey.toBase58()} ...`)

    const grpcConf = loadGrpcConfig()
    console.table(grpcConf)

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

  } catch (error: any) {
    console.error(`❌ Error : ${error.message}`)
  }
}

main()