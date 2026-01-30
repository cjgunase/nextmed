# Drizzle ORM Setup with Neon

This document describes the Drizzle ORM setup for the NextMed project.

## Installation

```bash
npm i drizzle-orm @neondatabase/serverless dotenv
npm i -D drizzle-kit tsx
```

## Configuration Files

### `.env.local`
Contains the Neon database connection string:
```
DATABASE_URL='postgresql://neondb_owner:npg_Ecv7djU3tRni@ep-sparkling-leaf-abzdh2sw-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
```

### `drizzle.config.ts`
Drizzle Kit configuration for managing migrations:
```typescript
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local' });

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## File Structure

```
📦 nextmed
 ├ 📂 drizzle         # Migration files
 ├ 📂 src
 │   ├ 📂 db
 │   │  ├ 📜 schema.ts    # Database schema definitions
 │   │  └ 📜 index.ts     # Database connection
 │   └ 📜 test-db.ts      # Test script
 ├ 📜 .env.local
 ├ 📜 drizzle.config.ts
 └ 📜 package.json
```

## Usage

### Database Connection
Import the database instance from `src/db/index.ts`:
```typescript
import { db } from '@/db';
```

### Schema Definition
Define tables in `src/db/schema.ts`:
```typescript
import { integer, pgTable, varchar } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  age: integer().notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
});
```

### Push Schema Changes
Apply schema changes to the database:
```bash
npx drizzle-kit push
```

### Generate and Apply Migrations
```bash
# Generate migration files
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate
```

### Drizzle Studio
View and manage your database using Drizzle Studio:
```bash
npx drizzle-kit studio
```

## CRUD Operations Example

```typescript
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { usersTable } from '@/db/schema';

// Create
await db.insert(usersTable).values({
  name: 'John',
  age: 30,
  email: 'john@example.com',
});

// Read
const users = await db.select().from(usersTable);

// Update
await db
  .update(usersTable)
  .set({ age: 31 })
  .where(eq(usersTable.email, 'john@example.com'));

// Delete
await db
  .delete(usersTable)
  .where(eq(usersTable.email, 'john@example.com'));
```

## Testing

Run the test script to verify the connection:
```bash
npx tsx src/test-db.ts
```

## Notes

- The connection uses Neon's HTTP driver for serverless compatibility
- Environment variables are loaded from `.env.local` (Next.js convention)
- Keep database credentials secure and never commit them to version control
