import { MongoClient, Collection, Db, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = 'msniper';

export interface DbTokenInfo {
  mint: string;
  symbol: string;
  name: string;
  creator: string;
  twitter: string;
  telegram: string;
  website: string;
  createdAt: Date;
}

export interface DbTradeHistory {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  devBuy: number;
  txHash?: string;
}

export class DbTokenService {
  private client: MongoClient;
  private db: Db;
  private collection: Collection<DbTokenInfo>;

  constructor() {
    this.client = new MongoClient(uri);
    this.db = this.client.db(dbName);
    this.collection = this.db.collection<DbTokenInfo>('tokens');
  }

  async connect() {
    await this.client.connect();
  }

  async disconnect() {
    await this.client.close();
  }

  async createToken(tokenInfo: DbTokenInfo) {
    return this.collection.insertOne(tokenInfo);
  }

  async getTokenByMint(mint: string) {
    return this.collection.findOne({ mint });
  }

  async getAllTokens() {
    return this.collection.find().toArray();
  }

  async updateToken(mint: string, data: Partial<DbTokenInfo>) {
    return this.collection.updateOne(
      { mint },
      { $set: data }
    );
  }

  async deleteToken(mint: string) {
    return this.collection.deleteOne({ mint });
  }
}

export class DbTradeHistoryService {
  private client: MongoClient;
  private db: Db;
  private collection: Collection<DbTradeHistory>;

  constructor() {
    this.client = new MongoClient(uri);
    this.db = this.client.db(dbName);
    this.collection = this.db.collection<DbTradeHistory>('trade_history');
  }

  async connect() {
    await this.client.connect();
  }

  async disconnect() {
    await this.client.close();
  }

  async createTradeRecord(tradeRecord: DbTradeHistory) {
    return this.collection.insertOne(tradeRecord);
  }

  async getTradeHistoryByMint(mint: string) {
    return this.collection.find({ mint }).sort({ timestamp: -1 }).toArray();
  }

  async getTradeHistoryByCreator(creator: string) {
    return this.collection.find({ creator }).sort({ timestamp: -1 }).toArray();
  }

  async getAllTradeHistory(limit?: number) {
    const query = this.collection.find().sort({ timestamp: -1 });
    if (limit) {
      query.limit(limit);
    }
    return query.toArray();
  }

  async getTradeHistoryByName(name: string) {
    return this.collection.find({ name }).sort({ timestamp: -1 }).toArray();
  }

  async getTradeHistoryBySymbol(symbol: string) {
    return this.collection.find({ symbol }).sort({ timestamp: -1 }).toArray();
  }

  async deleteTradeRecord(id: string) {
    return this.collection.deleteOne({ _id: new ObjectId(id) });
  }
}

// Initialize services
export const tokenService = new DbTokenService();
export const tradeHistoryService = new DbTradeHistoryService();

