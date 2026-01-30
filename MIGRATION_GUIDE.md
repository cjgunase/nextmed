# Migration Guide: Rule Compliance Refactor

This guide documents the changes needed to bring the codebase into full compliance with project rules.

## Overview

This migration addresses critical security and architectural violations:
- **Security**: Add Clerk authentication and data isolation
- **Architecture**: Replace API routes with Server Components and Server Actions
- **Validation**: Implement Zod schemas throughout

## Migration Steps

### Phase 1: Database Schema Updates ⚠️ BREAKING CHANGE

#### 1.1 Add `userId` Column to Cases Table

**File**: `src/db/schema.ts`

**Changes**:
- Add `userId` field to `cases` table
- Add relation from cases to users
- Update TypeScript types

**Impact**: 
- Existing case records will need migration
- All case queries must filter by userId

**Command to apply**:
```bash
npx drizzle-kit push
```

**Data Migration** (if you have existing data):
```sql
-- Option 1: Assign all existing cases to a specific user
UPDATE cases SET user_id = 'user_xxxxx' WHERE user_id IS NULL;

-- Option 2: Delete existing test data
DELETE FROM cases;
```

---

### Phase 2: Authentication & Authorization 🔒 CRITICAL

#### 2.1 Update Middleware for Route Protection

**File**: `src/proxy.ts`

**Changes**:
- Configure protected routes
- Require authentication for API routes
- Protect future dashboard/admin routes

**Impact**: Unauthenticated users will be redirected to sign-in

---

#### 2.2 Add Authentication to Existing API Routes

**Files**:
- `src/app/api/cases/route.ts`
- `src/app/api/cases/[id]/route.ts`

**Changes**:
- Import `auth` from Clerk
- Verify user authentication
- Filter queries by userId
- Return 401 for unauthenticated requests

**Impact**: API routes will require authentication

---

### Phase 3: Server Components & Actions Architecture 🏗️

#### 3.1 Create Zod Schemas

**New File**: `src/schemas/case.ts`

**Purpose**: Centralized validation schemas for case operations

---

#### 3.2 Create Server Actions

**New File**: `src/actions/case.ts`

**Actions to create**:
- `createCase()` - Create new case with validation
- `updateCase()` - Update existing case
- `deleteCase()` - Delete case (with ownership check)
- `publishCase()` - Toggle case publication status

**Pattern**: All actions use Zod validation and auth checks

---

#### 3.3 Create Server Components for Data Fetching

**New Files**:
- `src/app/cases/page.tsx` - List all user's cases
- `src/app/cases/[id]/page.tsx` - View single case

**Pattern**: Fetch data directly in async Server Components

---

### Phase 4: Deprecation & Cleanup

#### 4.1 Deprecate API Routes (Optional)

**Decision Point**: Keep or remove API routes?

**Option A - Remove** (recommended):
- Delete `src/app/api/cases/` directory
- Use Server Components only

**Option B - Keep for external API**:
- Keep routes but enforce authentication
- Document as public API with auth token

---

## Testing Checklist

After migration, verify:

- [ ] **Authentication**
  - [ ] Unauthenticated users cannot access protected routes
  - [ ] Authenticated users can only see their own cases
  - [ ] API routes return 401 for unauthenticated requests

- [ ] **Data Isolation**
  - [ ] User A cannot see User B's cases
  - [ ] User A cannot modify User B's cases
  - [ ] All queries filter by authenticated userId

- [ ] **Validation**
  - [ ] Invalid data is rejected with clear error messages
  - [ ] Zod schemas validate all inputs
  - [ ] TypeScript types are enforced

- [ ] **Functionality**
  - [ ] Cases can be created via Server Actions
  - [ ] Cases can be viewed in Server Components
  - [ ] Cases can be updated and deleted
  - [ ] Published cases are visible (to owner)

---

## Rollback Plan

If issues occur:

1. **Database Schema**: 
   ```bash
   git checkout HEAD -- src/db/schema.ts
   npx drizzle-kit push
   ```

2. **Code Changes**:
   ```bash
   git checkout HEAD -- src/app/ src/actions/ src/schemas/
   ```

3. **Middleware**:
   ```bash
   git checkout HEAD -- src/proxy.ts
   ```

---

## Timeline

- **Phase 1** (Schema): 15 minutes + testing
- **Phase 2** (Auth): 20 minutes + testing
- **Phase 3** (Architecture): 30 minutes + testing
- **Phase 4** (Cleanup): 10 minutes

**Total estimated time**: ~90 minutes

---

## Support

See project rules for detailed patterns:
- `.agent/rules/clerk-auth-data-isolation.md`
- `.agent/rules/data-handling-rule.md`
- `.agent/rules/database-interaction-rule.md`

---

## Post-Migration

After completing this migration:

1. Update `DATABASE_IMPLEMENTATION.md` with new schema
2. Re-seed database with user-owned test data
3. Update any existing tests
4. Document the Server Actions API for team

---

**Last Updated**: 2026-01-30
**Migration Status**: 🚧 In Progress
