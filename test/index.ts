import { solWalletGetBalance, solWalletImport } from "dv-sol-lib"
import { trade } from "../src/trade"
import { TokenInfo } from "../src/types"

const gSigner = solWalletImport(process.env.PRIVATE_KEY!)!
async function main() {
  const balance = await solWalletGetBalance(gSigner.publicKey)
  console.log(gSigner.publicKey.toBase58(), balance)
}

main()