interface TakeProfitLevel {
    percentage: number;
    sellAmount: number;
    executed: boolean;
}

interface TokenTakeProfit {
    mintAddress: string;
    entryPrice: number;
    takeProfitLevels: TakeProfitLevel[];
}

export class TakeProfitManager {
    private tokenTakeProfits: Map<string, TokenTakeProfit>;

    constructor() {
        this.tokenTakeProfits = new Map();
    }

    /**
     * Initialize take-profit tracking for a new token
     * @param mintAddress Token mint address
     * @param entryPrice Entry price of the token
     * @param takeProfitLevels Take-profit configuration levels
     */
    initializeToken(
        mintAddress: string,
        entryPrice: number,
        takeProfitLevels: { percentage: number; sellAmount: number }[]
    ): void {
        const levels = takeProfitLevels.map(level => ({
            ...level,
            executed: false
        }));

        this.tokenTakeProfits.set(mintAddress, {
            mintAddress,
            entryPrice,
            takeProfitLevels: levels
        });
    }

    /**
     * Check if any take-profit levels have been reached and execute sells
     * @param mintAddress Token mint address
     * @param currentPrice Current token price
     */
    checkTakeProfits(mintAddress: string, currentPrice: number): number {
        const tokenData = this.tokenTakeProfits.get(mintAddress);
        if (!tokenData) return 0;

        const profitPercentage = ((currentPrice - tokenData.entryPrice) / tokenData.entryPrice) * 100;

        for (const level of tokenData.takeProfitLevels) {
            if (!level.executed && profitPercentage >= level.percentage) {
                return level.sellAmount
            }
        }
        return 0
    }

    markupLevel(mintAddress: string, currentPrice: number) {
        const tokenData = this.tokenTakeProfits.get(mintAddress);
        if (!tokenData) return;

        const profitPercentage = ((currentPrice - tokenData.entryPrice) / tokenData.entryPrice) * 100;

        for (const level of tokenData.takeProfitLevels) {
            if (!level.executed && profitPercentage >= level.percentage) {
                level.executed = true
            }
        }
        // Remove token if all take-profit levels have been executed
        if (tokenData.takeProfitLevels.every(level => level.executed)) {
            this.tokenTakeProfits.delete(mintAddress);
        }
    }

    /**
     * Execute take-profit sell
     * @param mintAddress Token mint address
     * @param currentPrice Current token price
     * @param level Take-profit level that was reached
     */
    private async executeTakeProfit(
        mintAddress: string,
        currentPrice: number,
        level: TakeProfitLevel
    ): Promise<void> {
        try {
            // TODO: Implement your sell logic here
            console.log(
                `Executing take-profit sell for ${mintAddress} at ${level.percentage}% profit, ` +
                `selling ${level.sellAmount}% of tokens at price ${currentPrice}`
            );

            // Example sell implementation:
            // await sellToken(
            //     this.connection,
            //     new PublicKey(mintAddress),
            //     level.sellAmount,
            //     currentPrice
            // );
        } catch (error) {
            console.error(`Failed to execute take-profit sell for ${mintAddress}:`, error);
        }
    }

    /**
     * Remove a token from take-profit tracking
     * @param mintAddress Token mint address to remove
     */
    removeToken(mintAddress: string): void {
        this.tokenTakeProfits.delete(mintAddress);
    }

    /**
     * Get current take-profit status for a token
     * @param mintAddress Token mint address
     * @returns Current take-profit status or undefined if not tracking
     */
    getTokenStatus(mintAddress: string): TokenTakeProfit | undefined {
        return this.tokenTakeProfits.get(mintAddress);
    }

    /**
     * Clear all tracked take-profits
     */
    clear(): void {
        this.tokenTakeProfits.clear();
    }
} 