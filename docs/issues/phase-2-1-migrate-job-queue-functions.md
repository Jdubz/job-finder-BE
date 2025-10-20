# PHASE-2-1 — Migrate Job Queue Functions from Portfolio

> **Context**: See [README.md](../../README.md) and [API.md](../../API.md) for job queue API specifications
> **Architecture**: Firebase callable functions for job submission, queue management, and status tracking

---

## Issue Metadata

```yaml
Title: PHASE-2-1 — Migrate Job Queue Functions from Portfolio
Labels: priority-p1, repository-backend, type-migration, status-todo, phase-2
Assignee: Worker A
Priority: P1-High
Estimated Effort: 8-12 hours
Repository: job-finder-BE
```

---

## Summary

**Problem**: Job queue management functions currently exist in the portfolio repository and need to be migrated to job-finder-BE. These functions handle job submission, company submission, scrape requests, queue status retrieval, and queue item management.

**Goal**: Migrate all job queue-related Cloud Functions from portfolio to job-finder-BE, ensuring API compatibility with job-finder-FE and proper integration with Firestore queue collections.

**Impact**: Enables frontend to submit jobs, track processing status, and manage the queue. Core functionality for the entire job-finder application workflow.

---

## Architecture References

> **📚 Read these docs first for context:**

- **[API.md](../../API.md)** - Complete job queue API specifications with examples
- **[BACKEND_MIGRATION_PLAN.md](../../../docs/architecture/BACKEND_MIGRATION_PLAN.md)** - Phase 2, Task 2.1
- **Portfolio Source**: `/home/jdubz/Development/portfolio/functions/src/` (job-queue related files)

**Key concepts to understand**:
- Queue Item Lifecycle: pending → processing → success/failed/skipped
- Callable Functions: Firebase functions called directly from frontend with auth
- Queue Processors: Python worker consumes queue, backend manages submissions

---

## Tasks

### Phase 1: Migrate Core Queue Functions
1. **Migrate submitJob function**
   - What: Copy and adapt job submission function from portfolio
   - Where: `src/job-queue/submit-job.ts`
   - Why: Primary endpoint for users to submit job URLs
   - Test: Function accepts job URL, creates queue item, returns ID

2. **Migrate submitCompany function**
   - What: Copy and adapt company submission function
   - Where: `src/job-queue/submit-company.ts`
   - Why: Allows editors to submit entire company websites
   - Test: Function accepts company URL, creates company queue item

3. **Migrate submitScrape function**
   - What: Copy and adapt scrape request function
   - Where: `src/job-queue/submit-scrape.ts`
   - Why: Triggers automated job scraping across all sources
   - Test: Function creates scrape queue item with config

### Phase 2: Migrate Queue Management Functions
4. **Migrate queue status functions**
   - What: Copy getQueueStatus, getQueueStats functions
   - Where: `src/job-queue/get-queue-status.ts`, `src/job-queue/get-queue-stats.ts`
   - Why: Frontend needs to display queue status and statistics
   - Test: Functions return queue item details and aggregate stats

5. **Migrate queue item management**
   - What: Copy retryQueueItem, deleteQueueItem functions
   - Where: `src/job-queue/retry-item.ts`, `src/job-queue/delete-item.ts`
   - Why: Admins need to retry failed items and clean up queue
   - Test: Functions update queue item status correctly

### Phase 3: Set Up Service Layer
6. **Create job queue service**
   - What: Extract business logic into service layer
   - Where: `src/services/job-queue.service.ts`
   - Why: Separates business logic from function handlers
   - Test: Service methods work independently of function layer

### Phase 4: Integration and Testing
7. **Update main index.ts**
   - What: Export all job queue functions
   - Where: `src/index.ts`
   - Why: Makes functions available for deployment
   - Test: Functions deploy and appear in Firebase console

8. **Create unit tests**
   - What: Write tests for queue functions and service
   - Where: `src/__tests__/job-queue.test.ts`
   - Why: Ensures functions work correctly and catch regressions
   - Test: All tests pass with good coverage

---

## Technical Details

### Files to Migrate/Create

```
COPY FROM PORTFOLIO:
- portfolio/functions/src/job-queue.ts → src/job-queue/
  - Extract individual functions into separate files

CREATE NEW:
- src/job-queue/submit-job.ts - Job submission function
- src/job-queue/submit-company.ts - Company submission function
- src/job-queue/submit-scrape.ts - Scrape request function
- src/job-queue/get-queue-status.ts - Queue status retrieval
- src/job-queue/get-queue-stats.ts - Queue statistics
- src/job-queue/retry-item.ts - Retry failed queue item
- src/job-queue/delete-item.ts - Delete queue item
- src/services/job-queue.service.ts - Business logic service
- src/types/job-queue.types.ts - TypeScript type definitions
- src/__tests__/job-queue.test.ts - Unit tests

MODIFY:
- src/index.ts - Export all job queue functions
```

### Key Implementation Notes

**Submit Job Function**:
```typescript
// src/job-queue/submit-job.ts
import * as functions from 'firebase-functions';
import { JobQueueService } from '@/services/job-queue.service';
import { logger } from '@/utils/logger';

export const submitJob = functions.https.onCall(async (data, context) => {
  // Validate authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Validate request data
  const { url, companyName, generationId } = data;
  if (!url || typeof url !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Valid URL required');
  }

  // Submit to queue
  const service = new JobQueueService();
  const queueItem = await service.submitJob({
    url,
    companyName,
    generationId,
    userId: context.auth.uid,
  });

  logger.info('Job submitted to queue', { queueItemId: queueItem.id, userId: context.auth.uid });
  return queueItem;
});
```

**Job Queue Service**:
```typescript
// src/services/job-queue.service.ts
import { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/database';

export class JobQueueService {
  constructor(private db: Firestore) {}

  async submitJob(data: JobSubmissionData): Promise<QueueItem> {
    const queueItem = {
      type: 'job',
      status: 'pending',
      url: data.url,
      company_name: data.companyName || '',
      submitted_by: data.userId,
      created_at: new Date().toISOString(),
      retry_count: 0,
      max_retries: 3,
    };

    const docRef = await this.db.collection(COLLECTIONS.JOB_QUEUE).add(queueItem);
    return { id: docRef.id, ...queueItem };
  }

  async getQueueStatus(queueItemId: string): Promise<QueueItem | null> {
    const doc = await this.db.collection(COLLECTIONS.JOB_QUEUE).doc(queueItemId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as QueueItem;
  }

  async getQueueStats(): Promise<QueueStats> {
    // Aggregate queue statistics
    const snapshot = await this.db.collection(COLLECTIONS.JOB_QUEUE).get();
    // Calculate stats...
  }
}
```

**API Endpoints Created**:
- `submitJob` - POST job URL to queue
- `submitCompany` - POST company website to queue
- `submitScrape` - POST scrape request to queue
- `getQueueStatus` - GET queue item by ID
- `getQueueStats` - GET aggregate queue statistics
- `retryQueueItem` - POST retry failed item
- `deleteQueueItem` - DELETE queue item

---

## Acceptance Criteria

- [ ] **submitJob works**: Can submit job URL and receive queue item ID
- [ ] **submitCompany works**: Can submit company URL (editor only)
- [ ] **submitScrape works**: Can submit scrape request
- [ ] **getQueueStatus works**: Can retrieve queue item status
- [ ] **getQueueStats works**: Returns accurate queue statistics
- [ ] **retryQueueItem works**: Can retry failed items
- [ ] **deleteQueueItem works**: Can delete queue items
- [ ] **Authentication enforced**: Unauthorized requests rejected
- [ ] **Validation working**: Invalid data returns appropriate errors
- [ ] **Service layer complete**: Business logic separated from handlers
- [ ] **Tests passing**: Unit tests cover all functions
- [ ] **Functions deployed**: All functions visible in Firebase console

---

## Testing

### Test Commands

```bash
# Build TypeScript
npm run build

# Run unit tests
npm test

# Run specific test file
npm test job-queue.test.ts

# Start emulator for manual testing
npm run serve

# Deploy to staging
npm run deploy:staging
```

### Manual Testing

```bash
# Step 1: Start emulator
npm run serve

# Step 2: Test submitJob (requires Firebase Auth token)
curl -X POST http://localhost:5001/{project-id}/us-central1/submitJob \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "url": "https://greenhouse.io/test-company/jobs/123",
      "companyName": "Test Company"
    }
  }'

# Step 3: Test getQueueStatus
curl -X POST http://localhost:5001/{project-id}/us-central1/getQueueStatus \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "queueItemId": "queue-item-id-from-step-2"
    }
  }'

# Step 4: Test getQueueStats
curl -X POST http://localhost:5001/{project-id}/us-central1/getQueueStats \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data": {}}'

# Step 5: Verify in Firestore
# Check Firebase console → Firestore → job-queue collection
# Should see new queue item from step 2
```

---

## Commit Message Template

```
feat(job-queue): migrate job queue functions from portfolio

Migrate all job queue management functions from portfolio to job-finder-BE
including job submission, company submission, scrape requests, queue status
retrieval, and queue item management. Implements complete API for frontend
integration.

Key changes:
- Migrate submitJob, submitCompany, submitScrape functions
- Migrate getQueueStatus and getQueueStats functions
- Migrate retryQueueItem and deleteQueueItem functions
- Create JobQueueService for business logic
- Add TypeScript types for queue items and requests
- Implement authentication and validation
- Write comprehensive unit tests
- Export all functions in index.ts

Testing:
- Unit tests pass for all functions and service methods
- Manual testing in emulator confirms all endpoints work
- Authentication properly enforced
- Validation rejects invalid requests
- Firestore queue items created correctly

Closes #5
```

---

## Related Issues

- **Depends on**: #1, #2, #4 (Project structure, shared infrastructure, Firebase config)
- **Blocks**: Frontend job submission workflows
- **Related**: #6 (Firestore integration), API.md queue endpoints

---

## Resources

### Documentation
- **Firebase Callable Functions**: https://firebase.google.com/docs/functions/callable
- **Firestore Node SDK**: https://firebase.google.com/docs/firestore/query-data/get-data
- **API Reference**: [API.md](../../API.md) - Job Queue section

### Portfolio Source
- **Location**: `/home/jdubz/Development/portfolio/functions/src/`
- **Files**: `job-queue.ts`, `services/job-queue.service.ts`, `types/job-queue.types.ts`

---

## Success Metrics

**How we'll measure success**:
- All 7 job queue functions deployed and operational
- Frontend can successfully submit jobs and track status
- Queue items created in Firestore with correct schema
- < 500ms response time for submission endpoints
- > 90% test coverage for queue functions

---

## Notes

**Questions? Need clarification?**
- Comment on this issue with specific questions
- Tag @PM for guidance
- Reference API.md for endpoint specifications

**Implementation Tips**:
- Start with submitJob - most critical function
- Test each function in emulator before moving to next
- Use TypeScript types from portfolio as starting point
- Maintain API compatibility with existing frontend
- Add request logging for debugging
- Handle edge cases (duplicate submissions, invalid URLs)
- Use transactions for queue item creation to prevent race conditions

**Queue Item States**:
- `pending`: Waiting to be processed
- `processing`: Currently being handled by Python worker
- `success`: Successfully processed
- `failed`: Processing failed (can be retried)
- `skipped`: Duplicate or blocked by filters
- `filtered`: Rejected by AI filter engine

---

**Created**: 2025-10-20
**Created By**: PM
**Last Updated**: 2025-10-20
**Status**: Todo
