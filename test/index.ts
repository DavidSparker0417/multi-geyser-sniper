import { trade } from "../src/trade"
import { TokenInfo } from "../src/types"

async function main() {
  const tokenInfo:TokenInfo = {
    mint: "6hnqWpThdZPRS3XvSQDQg7WjxGhgsVSg6AVp6bgYpump",
    creator: "GZVSEAajExLJEvACHHQcujBw7nJq98GWUEZtood9LM9b",
    initialPrice: 0.00035,
    devBuy: 2.97,
    devAmount: 0,
    mintBlock: 344094114,
    migrated: false
  }
  trade(tokenInfo)
}

main()