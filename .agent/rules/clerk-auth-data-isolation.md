---
description: All authentication is handled by Clerk. Users must only access their own data.
---

# Clerk Authentication & Data Isolation Rule

## Overview
This project uses **Clerk** for all authentication and authorization. It is **CRITICAL** that users can only access data that belongs to them and cannot access any data belonging to other users.

## Core Requirements

### 1. Authentication Provider
- **ALL** authentication is handled by Clerk
- Never implement custom authentication logic
- Use Clerk hooks and utilities for user session management
- Use `@clerk/nextjs` components and server functions

### 2. Data Isolation Principles
Every database query and API endpoint that accesses user-specific data MUST:
- Verify the user is authenticated via Clerk
- Filter data by the authenticated user's Clerk user ID
- Never allow user-supplied IDs to override authentication checks
- Return 401 Unauthorized if user is not authenticated
- Return 403 Forbidden if user attempts to access data they don't own

## Implementation Guidelines

### Server Actions & API Routes
```typescript
import { auth } from '@clerk/nextjs/server';

// Example server action
export async function getUserData() {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error('Unauthorized');
  }
  
  // ALWAYS filter by userId from Clerk
  const data = await db.query.table.findMany({
    where: eq(table.userId, userId)
  });
  
  return data;
}
```

### Client Components
```typescript
import { useUser } from '@clerk/nextjs';

export function UserComponent() {
  const { user, isLoaded, isSignedIn } = useUser();
  
  if (!isLoaded || !isSignedIn) {
    return <div>Please sign in</div>;
  }
  
  // Safe to use user.id here
}
```

### Route Protection with Middleware
Use Clerk middleware to protect entire routes before they're accessed:

```typescript
// src/proxy.ts (or middleware.ts depending on Next.js version)
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/admin(.*)',
  '/cases(.*)',      // All user-specific pages
  '/api/user(.*)',   // All user-specific API routes
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});
```

**Important**: Configure public routes explicitly. Any route not explicitly public should require authentication.

### Getting Current User Information

**Server Components/Actions:**
```typescript
import { auth, currentUser } from '@clerk/nextjs/server';

export default async function Page() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }
  
  // Use userId for data queries
  const userData = await getUserData(userId);
  
  // Or get full user object if needed
  const user = await currentUser();
  
  return <div>Hello {user?.firstName}!</div>;
}
```

**Client Components:**
```typescript
'use client';

import { useUser } from '@clerk/nextjs';

export default function ClientComponent() {
  const { isSignedIn, user, isLoaded } = useUser();
  
  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) return <div>Not signed in</div>;
  
  return <div>Hello {user.firstName}!</div>;
}
```

### Database Schema
- Every user-specific table MUST have a `userId` column (type: `text` or `varchar`)
- The `userId` should reference the Clerk user ID
- Consider adding database-level constraints where applicable
- Use indexes on `userId` columns for performance

### Middleware Protection
- Use Clerk middleware to protect routes
- Configure public routes explicitly in `middleware.ts`
- Default to requiring authentication

## Common Patterns to Avoid

❌ **NEVER** do this:
```typescript
// Accepting user ID from client - SECURITY VULNERABILITY
export async function getData(userId: string) {
  return db.query.table.findMany({
    where: eq(table.userId, userId) // Malicious user could pass any ID
  });
}
```

✅ **ALWAYS** do this:
```typescript
// Get user ID from Clerk authentication
export async function getData() {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  
  return db.query.table.findMany({
    where: eq(table.userId, userId) // Safe - comes from authenticated session
  });
}
```

## Row-Level Security (RLS)
If using Neon Postgres with RLS policies:
- Configure RLS policies to enforce user isolation at the database level
- Use Clerk JWT claims in RLS policies
- This provides defense-in-depth security

## Checklist for New Features
Before implementing any feature that accesses user data:
- [ ] Is the user authenticated via Clerk?
- [ ] Does the query filter by `userId` from `auth()`?
- [ ] Are there any user-supplied parameters that could bypass auth checks?
- [ ] Does the API return appropriate 401/403 status codes?
- [ ] Have you tested accessing the endpoint as a different user?
- [ ] Would a malicious user be able to access another user's data?

## Testing Data Isolation
When testing features:
1. Create at least 2 test accounts in Clerk
2. Create data for User A
3. Attempt to access User A's data while authenticated as User B
4. Verify that User B receives a 403 error or no results
5. Verify that User B cannot modify User A's data

## Exceptions
The ONLY exceptions to user data isolation:
- Admin-specific functionality (clearly marked and protected by admin role checks)
- Public data explicitly designed to be shared (e.g., public profiles)
- Aggregated/anonymized analytics

Even for exceptions, always verify authentication first.

## References

- **Project Setup**: See [`CLERK_SETUP.md`](../CLERK_SETUP.md) for initial Clerk configuration and environment setup
- **Clerk Documentation**: [https://clerk.com/docs](https://clerk.com/docs)
- **Next.js App Router Guide**: [https://clerk.com/docs/quickstarts/nextjs](https://clerk.com/docs/quickstarts/nextjs)
- **Clerk API Reference**: [https://clerk.com/docs/references/nextjs/overview](https://clerk.com/docs/references/nextjs/overview)

## Enforcement
- All code reviews MUST verify data isolation
- Any violation of this rule is a **CRITICAL** security issue
- When in doubt, ask: "Could a malicious user access someone else's data?"

---

**Remember**: Data isolation is not optional. It is a fundamental security requirement that protects user privacy and trust.
