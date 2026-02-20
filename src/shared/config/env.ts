export type Env = {
  MONGO_URI: string;
  OCM_API_KEY: string;
  OCM_BASE_URL: string;
};

export const loadEnv = (): Env => {
  const MONGO_URI = process.env.MONGO_URI ?? "mongodb://localhost:27017/jucr";
  const OCM_API_KEY = process.env.OCM_API_KEY ?? "";
  const OCM_BASE_URL = process.env.OCM_BASE_URL ?? "https://api.openchargemap.io/v3";

  return { MONGO_URI, OCM_API_KEY, OCM_BASE_URL };
};
