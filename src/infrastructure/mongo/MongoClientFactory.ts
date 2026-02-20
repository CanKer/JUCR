import { MongoClient } from "mongodb";

export const createMongoClient = async (mongoUri: string): Promise<MongoClient> => {
  const client = new MongoClient(mongoUri);
  await client.connect();
  return client;
};
