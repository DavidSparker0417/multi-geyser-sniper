
import { GrpcConfig, sleep } from "dv-sol-lib"
import * as fs from 'fs';

interface TradeConfig {
  enabled: boolean;
  simulation: boolean,
  amount: number;
  slippage: number;
  prioFee: number;
  buyTip: number;
  sellTip: number;
  tp: number;
  sl: number;
  timeout: number;
  idleSell: {
    enabled: boolean;
    idleTime: number;
    sellPercentage: number;
  },
  takeProfits: {
    percentage: number;
    sellAmount: number;
  }[]
}

interface Config {
  trade: TradeConfig
}

export let config: Config

async function loadConfig() {
  while (true) {
    try {
      const fdata = fs.readFileSync('config.json', 'utf8')
      config = JSON.parse(fdata)
      // console.log(config.priceMonitor)
      await sleep(3000)
    } catch (error) { }
  }
}

export function loadGrpcConfig(): GrpcConfig[] {
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

loadConfig()

// 4mufiHjTig2p9eRFbQKcmS5kd6yLUQFapzQQDrgvpump