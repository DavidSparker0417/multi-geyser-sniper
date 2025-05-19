export class TokenCache {
    private cache: Set<string>;
    private maxSize: number;

    constructor(maxSize: number = 1000) {
        this.cache = new Set<string>();
        this.maxSize = maxSize;
    }

    /**
     * Add a token mint address to the cache
     * @param mintAddress The token mint address to add
     * @returns boolean indicating if the address was added successfully
     */
    add(mintAddress: string): boolean {
        if (this.cache.size >= this.maxSize) {
            // Remove oldest entry if cache is full
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }
        return this.cache.add(mintAddress).has(mintAddress);
    }

    /**
     * Check if a token mint address exists in the cache
     * @param mintAddress The token mint address to check
     * @returns boolean indicating if the address exists in cache
     */
    has(mintAddress: string): boolean {
        return this.cache.has(mintAddress);
    }

    /**
     * Get the current size of the cache
     * @returns number of items in cache
     */
    size(): number {
        return this.cache.size;
    }

    /**
     * Clear all entries from the cache
     */
    clear(): void {
        this.cache.clear();
    }
}

// Create a singleton instance
export const tokenCache = new TokenCache();
