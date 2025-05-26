import { MongoClient, Collection, Db } from 'mongodb';

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

// Initialize service
export const tokenService = new DbTokenService();

