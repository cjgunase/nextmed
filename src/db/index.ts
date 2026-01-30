import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

// Load environment variables (for local development)
if (process.env.NODE_ENV !== 'production') {
    config({ path: '.env.local' });
}

// Create Neon HTTP connection
const connection = neon(process.env.DATABASE_URL!);

// Export database instance with schema for query API
export const db = drizzle(connection, { schema });

// Export schema and types for convenience
export * from './schema';
