# PumpFun Sniper

A high-performance Solana trading bot designed to monitor and trade tokens on the PumpFun platform. The bot uses gRPC for real-time transaction monitoring and implements sophisticated trading strategies with take-profit and stop-loss mechanisms.

## Features

- Real-time token mint detection using gRPC
- Automated trading with configurable parameters
- Take-profit and stop-loss mechanisms
- Token metadata tracking and caching
- Simulation mode for testing strategies

## Prerequisites

- Node.js (v22 or higher)
- A Solana wallet with SOL for trading

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd pumpfun-sniper
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
PRIVATE_KEY=your_solana_wallet_private_key
```

4. Create a `config.json` file with your trading parameters:
```json
{
  "trade": {
    "enabled": true,
    "simulation": false,
    "amount": 0.1,
    "slippage": 100,
    "prioFee": 0,
    "buyTip": 0,
    "sellTip": 0,
    "tp": 20,
    "sl": 10,
    "timeout": 300
  }
}
```

## Usage

Start the bot:
```bash
npm start
```

## Configuration

### Trading Parameters

- `enabled`: Enable/disable trading
- `simulation`: Run in simulation mode (no actual trades)
- `amount`: Amount of SOL to invest per trade
- `slippage`: Maximum allowed slippage percentage
- `prioFee`: Priority fee for transactions
- `buyTip`: Tip amount for buy transactions
- `sellTip`: Tip amount for sell transactions
- `tp`: Take-profit percentage
- `sl`: Stop-loss percentage
- `timeout`: Maximum time to hold a position (in seconds). Note: Set this value to one second less than your desired timeout (e.g., if you want to sell after 50s, set it to 49s)

## Architecture

The bot consists of several key components:

1. **Detection System**: Monitors new token mints using gRPC
2. **Trading Engine**: Executes trades based on configured parameters
3. **Token Cache**: Prevents duplicate processing of tokens

## Dependencies

- `@solana/web3.js`: Solana blockchain interaction
- `@coral-xyz/anchor`: Solana program interaction
- `@triton-one/yellowstone-grpc`: gRPC client for Solana
- `dv-sol-lib`: Custom Solana utilities

## Security Considerations

- Never share your private key
- Use environment variables for sensitive data
- Start with simulation mode to test strategies
- Monitor your wallet balance regularly
- Set appropriate stop-loss levels

