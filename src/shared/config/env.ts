export type Env = {
  MONGO_URI: string;
  OCM_API_KEY: string;
  OCM_BASE_URL: string;
};

const validateHttpUrl = (name: string, value: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute http/https URL. Received: ${value}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${name} must use http or https scheme. Received: ${value}`);
  }

  return value;
};

export const loadEnv = (env: NodeJS.ProcessEnv = process.env): Env => {
  const MONGO_URI = env.MONGO_URI ?? "mongodb://localhost:27017/jucr";
  const OCM_API_KEY = env.OCM_API_KEY ?? "";
  const OCM_BASE_URL = validateHttpUrl("OCM_BASE_URL", env.OCM_BASE_URL ?? "https://api.openchargemap.io/v3");

  return { MONGO_URI, OCM_API_KEY, OCM_BASE_URL };
};
