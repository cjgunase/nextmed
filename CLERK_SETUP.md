# Clerk Authentication Setup

## Setup Instructions

### 1. Get Your Clerk API Keys

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Create a new application or select an existing one
3. Navigate to **API Keys** in the sidebar
4. Copy your **Publishable Key** and **Secret Key**

### 2. Configure Environment Variables

Open `.env.local` and replace the placeholder values:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_... # Your actual publishable key
CLERK_SECRET_KEY=sk_test_...                   # Your actual secret key
```

⚠️ **Important**: Never commit real API keys to version control. The `.gitignore` file already excludes `.env*` files.

### 3. Run the Development Server

```bash
npm run dev
```

### 4. Test Authentication

1. Open [http://localhost:3000](http://localhost:3000)
2. Click **Sign Up** to create a new account
3. Sign in with your credentials
4. Your user profile should appear in the header

## Architecture

### Files Created/Modified

- **`src/proxy.ts`**: Clerk middleware using `clerkMiddleware()` for App Router (renamed from middleware.ts per Next.js 16 conventions)
- **`src/app/layout.tsx`**: Root layout wrapped with `<ClerkProvider>` and auth UI components
- **`.env.local`**: Environment variables (placeholder values only)

### Key Features

✅ **App Router Compatible**: Uses the latest `clerkMiddleware()` approach  
✅ **Modal Authentication**: Sign-in/sign-up forms open in modals  
✅ **User Profile**: `<UserButton>` component provides user menu  
✅ **Conditional Rendering**: `<SignedIn>` and `<SignedOut>` components  
✅ **Secure**: Environment variables stored in `.env.local` (gitignored)

## Usage in Your App

### Protect Routes

You can protect routes by updating the middleware:

```typescript
// src/proxy.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/admin(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});
```

### Get Current User (Server Side)

```typescript
import { auth, currentUser } from '@clerk/nextjs/server';

export default async function Page() {
  const { userId } = await auth();
  const user = await currentUser();
  
  return <div>Hello {user?.firstName}!</div>;
}
```

### Get Current User (Client Side)

```typescript
'use client';

import { useUser } from '@clerk/nextjs';

export default function ClientComponent() {
  const { isSignedIn, user } = useUser();
  
  if (!isSignedIn) return <div>Not signed in</div>;
  
  return <div>Hello {user.firstName}!</div>;
}
```

## Resources

- [Clerk Documentation](https://clerk.com/docs)
- [Next.js App Router Quickstart](https://clerk.com/docs/quickstarts/nextjs)
- [Clerk API Reference](https://clerk.com/docs/references/nextjs/overview)
