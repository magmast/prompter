import { createEnv } from "@t3-oss/env-nextjs";
import { config } from "dotenv";
import { z } from "zod";

config({ path: ".env.local" });

export const env = createEnv({
  server: {
    OPENROUTER_API_KEY: z.string(),
    AUTH_SECRET: z.string(),
    BLOB_READ_WRITE_TOKEN: z.string().optional(),
    POSTGRES_URL: z.string(),
  },
});
