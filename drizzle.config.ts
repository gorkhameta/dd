import 'dotenv/config'; // ✅ loads env variables from .env
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL as string, // ✅ pulls from .env
  },
});
