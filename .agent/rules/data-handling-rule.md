---
description: Server-side data handling and validation requirements
---

# Data Handling and Validation Rules

This rule defines the required patterns for all database operations and data validation in the application.

## Server Components for Data Retrieval

**Rule:** All data retrieval from the database MUST be done via Server Components.

- ✅ **DO:** Fetch data in Server Components (`async` components in the App Router)
- ❌ **DON'T:** Fetch data in Client Components or use client-side data fetching

**Example:**

```tsx
// ✅ CORRECT: Server Component fetching data
export default async function DashboardPage() {
  const data = await db.query.users.findMany();
  return <Dashboard data={data} />;
}

// ❌ INCORRECT: Client Component fetching data
'use client';
export default function DashboardPage() {
  const [data, setData] = useState([]);
  useEffect(() => {
    fetch('/api/users').then(/* ... */);
  }, []);
  return <Dashboard data={data} />;
}
```

## Server Actions for Data Mutations

**Rule:** All database mutations (INSERT, UPDATE, DELETE) MUST be performed via Server Actions.

- ✅ **DO:** Use Server Actions with the `'use server'` directive
- ❌ **DON'T:** Execute mutations in API routes, Client Components, or directly in Server Components

**Example:**

```tsx
// ✅ CORRECT: Server Action for mutations
'use server';

export async function updateUser(data: UpdateUserInput) {
  const validated = updateUserSchema.parse(data);
  return await db.update(users).set(validated).where(eq(users.id, validated.id));
}

// ❌ INCORRECT: Direct mutation in Server Component
export default async function UserPage() {
  await db.delete(users).where(eq(users.id, userId)); // DON'T DO THIS
}
```

## Zod for Data Validation

**Rule:** All data validation MUST be done using Zod schemas.

- ✅ **DO:** Define Zod schemas for all data structures and validate before database operations
- ❌ **DON'T:** Use manual validation, skip validation, or rely on TypeScript types alone

**Example:**

```tsx
import { z } from 'zod';

// ✅ CORRECT: Define and use Zod schema
const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

export async function createUser(data: CreateUserInput) {
  const validated = createUserSchema.parse(data);
  return await db.insert(users).values(validated);
}
```

## TypeScript Types for Server Action Parameters

**Rule:** All data passed to Server Actions MUST:
1. Be validated by Zod
2. Have an explicit TypeScript type definition
3. **NEVER** use `FormData` as the parameter type

- ✅ **DO:** Define TypeScript types/interfaces for your data structures
- ❌ **DON'T:** Use `FormData` as the parameter type

**Example:**

```tsx
// ✅ CORRECT: Typed parameter with Zod validation
type CreateUserInput = {
  name: string;
  email: string;
  age?: number;
};

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

export async function createUser(data: CreateUserInput) {
  const validated = createUserSchema.parse(data);
  return await db.insert(users).values(validated);
}

// ❌ INCORRECT: Using FormData as parameter type
export async function createUser(formData: FormData) {
  const name = formData.get('name');
  // ...
}
```

## Complete Pattern Example

Here's how these rules work together:

```tsx
// schemas/user.ts
import { z } from 'zod';

export const updateUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// actions/user.ts
'use server';

import { updateUserSchema, type UpdateUserInput } from '@/schemas/user';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function updateUser(data: UpdateUserInput) {
  // Validate with Zod
  const validated = updateUserSchema.parse(data);
  
  // Perform database mutation
  const [updatedUser] = await db
    .update(users)
    .set(validated)
    .where(eq(users.id, validated.id))
    .returning();
  
  return updatedUser;
}

// app/users/[id]/page.tsx (Server Component)
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { UserForm } from '@/components/UserForm';

export default async function UserPage({ params }: { params: { id: string } }) {
  // Fetch data in Server Component
  const user = await db.query.users.findFirst({
    where: eq(users.id, params.id),
  });
  
  if (!user) {
    return <div>User not found</div>;
  }
  
  return <UserForm user={user} />;
}

// components/UserForm.tsx (Client Component)
'use client';

import { updateUser } from '@/actions/user';
import { type UpdateUserInput } from '@/schemas/user';

export function UserForm({ user }: { user: User }) {
  async function handleSubmit(data: UpdateUserInput) {
    // Call Server Action with typed data
    await updateUser(data);
  }
  
  // ... form implementation
}
```

## Summary

1. **Data Retrieval** → Server Components
2. **Data Mutations** → Server Actions
3. **Validation** → Zod schemas (always)
4. **Types** → Explicit TypeScript types (never FormData)

These patterns ensure type safety, security, and adherence to Next.js App Router best practices.
