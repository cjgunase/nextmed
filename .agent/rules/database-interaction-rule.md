---
title: Database Interaction Rule
description: All database interactions must use Drizzle ORM schema and queries
priority: high
---

# Database Interaction Rule

## Core Principle
**ALL database interactions in this project MUST use Drizzle ORM with the defined schema and query patterns. Direct SQL queries, raw database connections, or other ORMs are strictly prohibited.**

## Required Practices

### 1. Import Database Client and Schema
Always import from the centralized database module:

```typescript
// ✅ CORRECT - Use centralized imports
import { db } from '@/db';
import { cases, caseStages, stageOptions, users } from '@/db/schema';
import { eq, and, or, desc, asc } from 'drizzle-orm';

// ❌ FORBIDDEN - Never create direct connections
import { Client } from 'pg';
import postgres from 'postgres';
```

### 2. Use Drizzle Query Patterns

#### Reading Data
```typescript
// ✅ CORRECT - Use Drizzle's query API
const publishedCases = await db.query.cases.findMany({
  where: eq(cases.isPublished, true),
  with: {
    stages: {
      orderBy: (stages, { asc }) => [asc(stages.stageOrder)],
      with: {
        options: true,
      },
    },
  },
});

// ✅ CORRECT - Use select with filters
const specificCase = await db
  .select()
  .from(cases)
  .where(eq(cases.id, caseId));

// ❌ FORBIDDEN - Never use raw SQL
const result = await db.execute(sql`SELECT * FROM cases WHERE id = ${id}`);
```

#### Writing Data
```typescript
// ✅ CORRECT - Use Drizzle insert
await db.insert(users).values({
  id: clerkUserId,
  email: userEmail,
  role: 'student',
});

// ✅ CORRECT - Use Drizzle update
await db
  .update(cases)
  .set({ isPublished: true, updatedAt: new Date() })
  .where(eq(cases.id, caseId));

// ❌ FORBIDDEN - Never use raw SQL
await db.execute(sql`UPDATE cases SET is_published = true WHERE id = ${id}`);
```

#### Deleting Data
```typescript
// ✅ CORRECT - Use Drizzle delete
await db
  .delete(cases)
  .where(eq(cases.id, caseId));

// ❌ FORBIDDEN - Never use raw SQL
await db.execute(sql`DELETE FROM cases WHERE id = ${id}`);
```

### 3. Type Safety and Type Inference

Always use the type exports from the schema:

```typescript
// ✅ CORRECT - Use inferred types
import type { Case, NewCase, CaseStage, StageOption } from '@/db/schema';

function createCase(newCase: NewCase): Promise<Case> {
  // Implementation
}

// ✅ CORRECT - Use type inference
const insertedCase = await db.insert(cases).values(newCase).returning();
// insertedCase is automatically typed as Case[]

// ❌ FORBIDDEN - Never use generic types
function createCase(newCase: any): Promise<any> {
  // Bad practice
}
```

### 4. Leverage Drizzle Relations

Use the defined relations for nested queries instead of manual joins:

```typescript
// ✅ CORRECT - Use relations for nested data
const caseWithStages = await db.query.cases.findFirst({
  where: eq(cases.id, caseId),
  with: {
    stages: {
      with: {
        options: true,
      },
    },
  },
});

// ❌ AVOID - Manual joins when relations exist
const result = await db
  .select()
  .from(cases)
  .leftJoin(caseStages, eq(cases.id, caseStages.caseId))
  .leftJoin(stageOptions, eq(caseStages.id, stageOptions.stageId));
```

### 5. Use Schema-Defined Enums

Always use the exported enum types from the schema:

```typescript
// ✅ CORRECT - Use schema enums
import { userRoles, difficultyLevels } from '@/db/schema';
import type { UserRole, DifficultyLevel } from '@/db/schema';

const role: UserRole = 'student'; // Type-safe
const difficulty: DifficultyLevel = 'Foundation'; // Type-safe

// ❌ FORBIDDEN - Hard-coded strings without type safety
const role = 'student'; // Not type-safe
const difficulty = 'Easy'; // Wrong value, would fail at runtime
```

## Forbidden Practices

### ❌ Never Use Raw SQL
```typescript
// FORBIDDEN
await db.execute(sql`SELECT * FROM users`);
await pool.query('SELECT * FROM cases');
```

### ❌ Never Create Direct Database Connections
```typescript
// FORBIDDEN
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
```

### ❌ Never Use Other ORMs
```typescript
// FORBIDDEN - No Prisma, TypeORM, Sequelize, etc.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
```

### ❌ Never Bypass Type Safety
```typescript
// FORBIDDEN
const data: any = await db.select().from(cases);
const result = await db.query.cases.findMany() as any;
```

## Database Schema Reference

Current tables and their purposes:

| Table | Purpose | Key Relations |
|-------|---------|---------------|
| `users` | Store user accounts (from Clerk) | None currently |
| `cases` | Medical scenario cases | One-to-many with `case_stages` |
| `case_stages` | Time-based steps within a case | Many-to-one with `cases`, One-to-many with `stage_options` |
| `stage_options` | Decision points for each stage | Many-to-one with `case_stages` |

## Schema Modification Guidelines

When you need to modify the database schema:

1. **Update Schema File**: Edit `src/db/schema.ts`
2. **Update Types**: Export new types using `$inferSelect` and `$inferInsert`
3. **Push to Database**: Run `npx drizzle-kit push`
4. **Update Seed Data**: Modify `src/db/seed.ts` if applicable
5. **Update Documentation**: Update `DATABASE_IMPLEMENTATION.md`

## Exception Handling

When working with database operations, always handle errors appropriately:

```typescript
// ✅ CORRECT - Proper error handling
try {
  const result = await db.insert(cases).values(newCase).returning();
  return result[0];
} catch (error) {
  console.error('Failed to create case:', error);
  throw new Error('Failed to create case');
}

// ❌ AVOID - Swallowing errors
try {
  await db.insert(cases).values(newCase);
} catch (error) {
  // Silent failure
}
```

## Performance Optimization

### Use Prepared Statements
```typescript
// ✅ CORRECT - Drizzle automatically prepares statements
const getPublishedCases = db.query.cases.findMany({
  where: eq(cases.isPublished, true),
});
```

### Leverage Indexes
The schema defines indexes on foreign keys. Use them effectively:
- `case_stages_case_id_idx` for filtering stages by case
- `stage_options_stage_id_idx` for filtering options by stage

### Select Only Required Fields
```typescript
// ✅ GOOD - Select specific columns
const caseTitles = await db
  .select({ id: cases.id, title: cases.title })
  .from(cases);

// ⚠️ ACCEPTABLE but less efficient
const allCases = await db.select().from(cases);
```

## JSON Fields

When working with the `clinicalData` JSONB field:

```typescript
// ✅ CORRECT - Use the ClinicalData type
import type { ClinicalData } from '@/db/schema';

const clinicalData: ClinicalData = {
  BP: '120/80',
  HR: 75,
  RR: 16,
  Temp: 37.2,
  SpO2: 98,
  labs: {
    'Hb': 14.2,
    'WBC': 7.5,
  },
};

await db.insert(caseStages).values({
  caseId: 1,
  stageOrder: 1,
  narrative: 'Patient presents with...',
  clinicalData,
});
```

## Testing Database Operations

When writing tests, use the same Drizzle patterns:

```typescript
// ✅ CORRECT - Test with Drizzle
import { db } from '@/db';
import { cases } from '@/db/schema';

describe('Case Creation', () => {
  it('should create a new case', async () => {
    const newCase = await db.insert(cases).values({
      title: 'Test Case',
      description: 'Test Description',
      clinicalDomain: 'Cardiology',
      difficultyLevel: 'Foundation',
    }).returning();
    
    expect(newCase[0]).toHaveProperty('id');
  });
});
```

---

**Remember**: Consistency in database access patterns ensures type safety, maintainability, and prevents SQL injection vulnerabilities. Always use Drizzle ORM as defined in this project's schema.
