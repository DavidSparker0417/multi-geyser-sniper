import { GrpcConfig, PF_MINT_AUTHORITY, PF_WALLET, solTrGrpcPfStart, solTrGrpcWalletStart } from "dv-sol-lib";
import { detectionPf, suppliers } from "./detection";
import { signer } from "./trade";
import { config } from "./config";
import { trackerTask } from "./tracker";
import { access } from "fs";
import { url } from "inspector";

async function onSupplierTr(data: any) {
  if (!data || data.type !== "SolTransfer")
    return

  if (data.amount < config.supAmount[0] || data.amount > config.supAmount[1])
    return

  if (suppliers.find((s: string) => s === data.to))
    return

  if (config.suppliers.find((s: string) => s === data.to))
    return

  console.log(`*************** adding ${data.to} to supplier ...`)
  suppliers.push(data.to)
}

function loadGrpcConfig(): GrpcConfig[] {
    const endpoints = process.env.GRPC_ENDPOINTS
    const accessTokens = process.env.GRPC_TOKENS
    if (!endpoints || !accessTokens)
      throw new Error('Environment mismatch: check gRPC endpoint and access token.')
    
    const urls = endpoints.split('\n')
    const tokens = accessTokens.split('\n')
    if (urls.length !== tokens.length)
      throw new Error('Mismatch between number of gRPC endpoints and access tokens.')
    
    const configs: GrpcConfig[] = []
    for (let idx = 0; idx < urls.length; idx++) {
      configs.push({
        url: urls[idx],
        accessToken: tokens[idx]
      });
    }
  return configs
}
async function main() {
  try {
    console.log(`---------------------------------------`)
    console.log(`🤖 Starting TG bot with ${signer.publicKey.toBase58()} ...`)

    const grpcConf = loadGrpcConfig()
    console.table(grpcConf)
    
    // botStart()
    console.log(`---------------------------------------`)
    console.log(`👀 Starting monitor handlers ...`)
    for(let i = 0; i < grpcConf.length; i ++) {
      solTrGrpcPfStart(
        (data:any) => {
          detectionPf(data, i)
        }, 
        [PF_MINT_AUTHORITY, PF_WALLET],
        grpcConf[i]
      )
    }

    solTrGrpcWalletStart(config.suppliers, onSupplierTr)

    trackerTask()
  } catch (error: any) {
    console.error(`❌ Error : ${error.message}`)
  }
}

main()