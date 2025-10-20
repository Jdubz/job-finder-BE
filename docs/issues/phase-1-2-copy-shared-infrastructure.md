# PHASE-1-2 — Copy Shared Infrastructure from Portfolio

> **Context**: See [README.md](../../README.md) for project overview and [BACKEND_MIGRATION_PLAN.md](../../../docs/architecture/BACKEND_MIGRATION_PLAN.md) for migration strategy
> **Architecture**: Shared configuration, middleware, and services from portfolio project

---

## Issue Metadata

```yaml
Title: PHASE-1-2 — Copy Shared Infrastructure from Portfolio
Labels: priority-p1, repository-backend, type-migration, status-todo, phase-1
Assignee: Worker A
Priority: P1-High
Estimated Effort: 6-8 hours
Repository: job-finder-BE
```

---

## Summary

**Problem**: The job-finder-BE needs foundational infrastructure (configuration, middleware, utilities, and core services) that already exists in the portfolio repository. This code needs to be copied and adapted for the job-finder context.

**Goal**: Copy and adapt shared infrastructure from portfolio/functions to job-finder-BE, including config management, authentication middleware, rate limiting, Firestore service, Secret Manager service, and utility functions.

**Impact**: Provides the foundation for all backend APIs with authentication, security, database access, and secret management. Ensures consistency with proven patterns from portfolio project.

---

## Architecture References

> **📚 Read these docs first for context:**

- **[BACKEND_MIGRATION_PLAN.md](../../../docs/architecture/BACKEND_MIGRATION_PLAN.md)** - Complete migration strategy, Phase 1 details
- **[README.md](../../README.md)** - Project architecture and structure
- **Portfolio Source**: `/home/jdubz/Development/portfolio/functions/src/` (or `dist/` for compiled code)

**Key concepts to understand**:
- Middleware Pattern: Reusable request/response handlers
- Service Layer: Business logic abstraction for Firestore and Secret Manager
- Configuration Management: Environment-specific settings and CORS

---

## Tasks

### Phase 1: Copy Configuration Files
1. **Copy and adapt config directory**
   - What: Copy `config/` from portfolio, adapt for job-finder
   - Where: Portfolio `functions/src/config/` → job-finder-BE `src/config/`
   - Why: Centralizes database, CORS, secrets configuration
   - Test: Config files import without errors, exports are typed

2. **Update CORS configuration**
   - What: Configure allowed origins for job-finder-FE (staging, production, localhost)
   - Where: `src/config/cors.ts`
   - Why: Allow frontend to make authenticated requests
   - Test: CORS origins include job-finder-FE URLs

### Phase 2: Copy Middleware
3. **Copy authentication middleware**
   - What: Copy `middleware/auth.middleware.ts` from portfolio
   - Where: `src/middleware/auth.middleware.ts`
   - Why: Validates Firebase Auth tokens, extracts user info
   - Test: Middleware correctly validates tokens and rejects invalid ones

4. **Copy rate limiting middleware**
   - What: Copy `middleware/rate-limit.middleware.ts` from portfolio
   - Where: `src/middleware/rate-limit.middleware.ts`
   - Why: Prevents API abuse and DDoS attacks
   - Test: Rate limiter blocks excessive requests

5. **Copy validation middleware (if exists)**
   - What: Copy request validation middleware if available
   - Where: `src/middleware/validation.middleware.ts`
   - Why: Validates request bodies and query parameters
   - Test: Validation middleware rejects invalid requests

### Phase 3: Copy Core Services
6. **Copy Firestore service**
   - What: Copy `services/firestore.service.ts`, adapt collection names for job-finder
   - Where: `src/services/firestore.service.ts`
   - Why: Provides typed Firestore access with error handling
   - Test: Service can read/write to Firestore collections

7. **Copy Secret Manager service**
   - What: Copy `services/secret-manager.service.ts` as-is
   - Where: `src/services/secret-manager.service.ts`
   - Why: Securely accesses API keys and credentials from GCP Secret Manager
   - Test: Service can fetch secrets from Secret Manager

### Phase 4: Copy Utilities
8. **Copy utility functions**
   - What: Copy `utils/logger.ts`, `utils/request-id.ts`, `utils/date-format.ts`
   - Where: `src/utils/logger.ts`, `src/utils/request-id.ts`, `src/utils/date-format.ts`
   - Why: Provides logging, request tracking, and date formatting helpers
   - Test: Utilities work correctly, logger outputs formatted messages

9. **Update imports throughout copied files**
   - What: Fix import paths to use @/ alias and local paths
   - Where: All copied files
   - Why: Ensures code compiles with job-finder-BE structure
   - Test: `npm run build` succeeds without import errors

---

## Technical Details

### Files to Copy/Modify

```
COPY FROM PORTFOLIO:
- portfolio/functions/src/config/*.ts → src/config/
  - database.ts (adapt for job-finder collections)
  - cors.ts (update allowed origins)
  - secrets.ts (adapt secret names if needed)

- portfolio/functions/src/middleware/*.ts → src/middleware/
  - auth.middleware.ts (copy as-is)
  - rate-limit.middleware.ts (copy as-is)
  - app-check.middleware.ts (copy if needed)

- portfolio/functions/src/services/*.ts → src/services/
  - firestore.service.ts (adapt collection references)
  - secret-manager.service.ts (copy as-is)

- portfolio/functions/src/utils/*.ts → src/utils/
  - logger.ts (copy as-is)
  - request-id.ts (copy as-is)
  - date-format.ts (copy as-is)

MODIFY:
- src/config/database.ts - Update collection names for job-finder
- src/config/cors.ts - Update allowed origins
- src/services/firestore.service.ts - Update collection references
- All copied files - Fix import paths
```

### Key Implementation Notes

**CORS Configuration**:
```typescript
// src/config/cors.ts
export const CORS_ALLOWED_ORIGINS = [
  'https://job-finder.web.app',              // Production
  'https://job-finder-staging.web.app',      // Staging
  'http://localhost:5173',                   // Local frontend dev
  'http://localhost:5001',                   // Local functions emulator
];
```

**Firestore Collections**:
```typescript
// src/config/database.ts
export const COLLECTIONS = {
  JOB_QUEUE: 'job-queue',
  JOB_MATCHES: 'job-matches',
  JOB_FINDER_CONFIG: 'job-finder-config',
  CONTENT_ITEMS: 'content-items',
  EXPERIENCES: 'experiences',
  GENERATION_HISTORY: 'generation-history',
  USER_DEFAULTS: 'user-defaults',
};
```

**Logger Usage**:
```typescript
// src/utils/logger.ts
import { logger } from '@/utils/logger';

logger.info('Processing queue item', { queueItemId, userId });
logger.error('Failed to fetch secret', { error, secretName });
logger.warn('Rate limit exceeded', { userId, endpoint });
```

**Integration Points**:
- Auth Middleware: Used by all protected endpoints to validate Firebase tokens
- Firestore Service: Used by all APIs to interact with database
- Secret Manager: Used to fetch API keys (OpenAI, Claude, etc.)
- Logger: Used throughout for structured logging and debugging

---

## Acceptance Criteria

- [ ] **Config copied**: All config files in `src/config/` and adapted
- [ ] **Middleware copied**: Auth, rate-limit, and other middleware in `src/middleware/`
- [ ] **Services copied**: Firestore and Secret Manager services in `src/services/`
- [ ] **Utilities copied**: Logger, request-id, date-format in `src/utils/`
- [ ] **Imports fixed**: All imports use correct paths (@/ alias where appropriate)
- [ ] **TypeScript compiles**: `npm run build` succeeds without errors
- [ ] **CORS configured**: Allowed origins include job-finder-FE URLs
- [ ] **Collections updated**: Firestore service references job-finder collections

---

## Testing

### Test Commands

```bash
# Build to check imports
npm run build

# Check for compilation errors
npm run build 2>&1 | grep -i error

# Lint to check code quality
npm run lint

# Verify exports
node -e "const config = require('./dist/config/database.js'); console.log(config.COLLECTIONS);"
```

### Manual Testing

```bash
# Step 1: Verify files copied
ls -la src/config/
ls -la src/middleware/
ls -la src/services/
ls -la src/utils/

# Step 2: Check for import errors
npm run build
# Should compile without errors

# Step 3: Verify CORS configuration
cat src/config/cors.ts
# Should include job-finder-FE URLs

# Step 4: Check collection names
cat src/config/database.ts
# Should reference job-finder collections

# Step 5: Test logger
node -e "const { logger } = require('./dist/utils/logger.js'); logger.info('Test message');"
```

---

## Commit Message Template

```
feat(infrastructure): copy shared infrastructure from portfolio

Copy and adapt foundational infrastructure from portfolio project including
configuration management, authentication middleware, rate limiting, Firestore
service, Secret Manager service, and utility functions. Updated for job-finder
context with correct collection names and CORS origins.

Key changes:
- Copy config/ directory with database, CORS, and secrets configuration
- Copy middleware/ directory with auth, rate-limit, and validation
- Copy services/ directory with Firestore and Secret Manager services
- Copy utils/ directory with logger, request-id, and date-format utilities
- Update CORS to allow job-finder-FE origins
- Update Firestore collection names for job-finder
- Fix all import paths for job-finder-BE structure

Testing:
- npm run build compiles successfully
- All imports resolve correctly
- CORS configuration includes job-finder-FE URLs
- Collection names reference job-finder Firestore schema

Closes #2
```

---

## Related Issues

- **Depends on**: #1 (Initialize project structure)
- **Blocks**: #5 (Migrate job-queue functions), #8 (Migrate generator functions)
- **Related**: BACKEND_MIGRATION_PLAN.md Phase 1, Task 2

---

## Resources

### Documentation
- **Firebase Admin SDK**: https://firebase.google.com/docs/admin/setup
- **Google Cloud Secret Manager**: https://cloud.google.com/secret-manager/docs
- **Express Middleware**: https://expressjs.com/en/guide/using-middleware.html

### Portfolio Source Files
- **Location**: `/home/jdubz/Development/portfolio/functions/src/`
- **Reference**: Check portfolio README for architecture patterns

---

## Success Metrics

**How we'll measure success**:
- Zero compilation errors after copying files
- All imports resolve correctly
- CORS middleware allows job-finder-FE requests
- Firestore service can access job-finder collections
- Logger produces structured, readable output

---

## Notes

**Questions? Need clarification?**
- Comment on this issue with specific questions
- Tag @PM for guidance
- Reference portfolio source code for implementation details

**Implementation Tips**:
- Copy TypeScript source files (`.ts`), not compiled JavaScript
- Use search/replace for bulk import path updates
- Test each service independently after copying
- Don't modify core logic - only adapt configuration and imports
- Keep portfolio-specific business logic out (e.g., contact form services)

---

**Created**: 2025-10-20
**Created By**: PM
**Last Updated**: 2025-10-20
**Status**: Todo
