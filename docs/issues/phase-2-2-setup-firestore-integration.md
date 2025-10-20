# PHASE-2-2 — Set Up Firestore Integration for Job-Finder

> **Context**: See [README.md](../../README.md) for database architecture and collections
> **Architecture**: Cloud Firestore for real-time data storage, security rules, and indexes

---

## Issue Metadata

```yaml
Title: PHASE-2-2 — Set Up Firestore Integration for Job-Finder
Labels: priority-p1, repository-backend, type-database, status-todo, phase-2
Assignee: Worker A
Priority: P1-High
Estimated Effort: 6-8 hours
Repository: job-finder-BE
```

---

## Summary

**Problem**: The job-finder-BE backend needs a properly configured Firestore database with collections for job queue, job matches, configuration, content items, and generation history. Security rules and indexes must be configured to ensure data integrity and performance.

**Goal**: Set up complete Firestore integration including collection schemas, security rules, composite indexes, and a Firestore service layer for type-safe database operations.

**Impact**: Enables all backend functions to securely read/write data, provides real-time updates to frontend, and ensures database queries are performant with proper indexing.

---

## Architecture References

> **📚 Read these docs first for context:**

- **[README.md](../../README.md)** - Project structure and Firestore collections
- **[BACKEND_MIGRATION_PLAN.md](../../../docs/architecture/BACKEND_MIGRATION_PLAN.md)** - Phase 2, Task 2.2
- **Firestore Documentation**: https://firebase.google.com/docs/firestore

**Key concepts to understand**:
- Collection Structure: Top-level collections for different data types
- Security Rules: Server-side validation and access control
- Composite Indexes: Required for complex queries with multiple filters

---

## Tasks

### Phase 1: Define Collection Schemas
1. **Document collection structure**
   - What: Define schema for each Firestore collection
   - Where: `docs/FIRESTORE_SCHEMA.md` (create)
   - Why: Clear documentation of data structure for all developers
   - Test: Schema documented with field types and descriptions

2. **Create Firestore service layer**
   - What: Build typed service for Firestore operations
   - Where: `src/services/firestore.service.ts`
   - Why: Type-safe database access with error handling
   - Test: Service methods perform CRUD operations correctly

### Phase 2: Configure Security Rules
3. **Write firestore.rules**
   - What: Define security rules for all collections
   - Where: `firestore.rules`
   - Why: Ensures users can only access authorized data
   - Test: Rules simulator passes all test cases

4. **Test security rules**
   - What: Create test cases for security rules
   - Where: `firestore.rules` (with test annotations) or separate test file
   - Why: Validates rules prevent unauthorized access
   - Test: All security rule tests pass

### Phase 3: Configure Indexes
5. **Create composite indexes**
   - What: Define indexes for common queries
   - Where: `firestore.indexes.json`
   - Why: Enables complex queries and improves performance
   - Test: All required queries work without "index required" errors

6. **Deploy Firestore configuration**
   - What: Deploy rules and indexes to staging/production
   - Where: Firebase console or CLI deployment
   - Why: Applies configuration to live databases
   - Test: Rules and indexes active in Firebase console

### Phase 4: Integration Testing
7. **Test Firestore operations**
   - What: Write integration tests for Firestore service
   - Where: `src/__tests__/firestore.service.test.ts`
   - Why: Validates database operations work end-to-end
   - Test: All integration tests pass

---

## Technical Details

### Firestore Collections

```
COLLECTIONS:
- job-queue - Queue items for job processing
  - Fields: type, status, url, company_name, submitted_by, created_at, retry_count, etc.

- job-matches - AI-analyzed job matches
  - Fields: job_id, user_id, match_score, title, company, url, analysis, created_at, etc.

- job-finder-config - System configuration
  - Documents: stop-list, ai-settings, queue-settings
  - Fields: excludedCompanies, excludedKeywords, minMatchScore, etc.

- content-items - User's experience and skills
  - Fields: type, title, description, tags, skills, created_at, updated_at, etc.

- experiences - Detailed work experience entries
  - Fields: company, role, start_date, end_date, description, achievements, etc.

- generation-history - AI document generation history
  - Fields: user_id, type, job_match_id, document_url, created_at, etc.

- user-defaults - User preferences and defaults
  - Fields: user_id, default_ai_settings, default_template, etc.
```

### Key Implementation Notes

**Firestore Service**:
```typescript
// src/services/firestore.service.ts
import { getFirestore, Firestore, CollectionReference } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/database';
import { logger } from '@/utils/logger';

export class FirestoreService {
  private db: Firestore;

  constructor() {
    this.db = getFirestore();
  }

  getCollection<T>(collectionName: string): CollectionReference<T> {
    return this.db.collection(collectionName) as CollectionReference<T>;
  }

  async getDocument<T>(collection: string, docId: string): Promise<T | null> {
    try {
      const doc = await this.db.collection(collection).doc(docId).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() } as T;
    } catch (error) {
      logger.error('Error fetching document', { collection, docId, error });
      throw error;
    }
  }

  async createDocument<T>(collection: string, data: T): Promise<string> {
    try {
      const docRef = await this.db.collection(collection).add(data);
      logger.info('Document created', { collection, docId: docRef.id });
      return docRef.id;
    } catch (error) {
      logger.error('Error creating document', { collection, error });
      throw error;
    }
  }

  async updateDocument<T>(collection: string, docId: string, data: Partial<T>): Promise<void> {
    try {
      await this.db.collection(collection).doc(docId).update(data);
      logger.info('Document updated', { collection, docId });
    } catch (error) {
      logger.error('Error updating document', { collection, docId, error });
      throw error;
    }
  }

  async deleteDocument(collection: string, docId: string): Promise<void> {
    try {
      await this.db.collection(collection).doc(docId).delete();
      logger.info('Document deleted', { collection, docId });
    } catch (error) {
      logger.error('Error deleting document', { collection, docId, error });
      throw error;
    }
  }
}
```

**Security Rules** (`firestore.rules`):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isEditor() {
      return isAuthenticated() &&
             (request.auth.token.editor == true || request.auth.token.email_verified == true);
    }

    // Job Queue - users can only access their own submissions
    match /job-queue/{queueId} {
      allow read: if isAuthenticated() && resource.data.submitted_by == request.auth.uid;
      allow create: if isAuthenticated() && request.resource.data.submitted_by == request.auth.uid;
      allow update, delete: if isEditor();
    }

    // Job Matches - users can only access their own matches
    match /job-matches/{matchId} {
      allow read: if isAuthenticated() && resource.data.user_id == request.auth.uid;
      allow write: if false; // Only backend can write
    }

    // Configuration - read by all authenticated, write by editors
    match /job-finder-config/{configDoc} {
      allow read: if isAuthenticated();
      allow write: if isEditor();
    }

    // Content Items - users access their own
    match /content-items/{itemId} {
      allow read, write: if isAuthenticated() && resource.data.user_id == request.auth.uid;
    }

    // Experiences - users access their own
    match /experiences/{experienceId} {
      allow read, write: if isAuthenticated() && resource.data.user_id == request.auth.uid;
    }

    // Generation History - users access their own
    match /generation-history/{historyId} {
      allow read: if isAuthenticated() && resource.data.user_id == request.auth.uid;
      allow write: if false; // Only backend can write
    }
  }
}
```

**Composite Indexes** (`firestore.indexes.json`):
```json
{
  "indexes": [
    {
      "collectionGroup": "job-queue",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "submitted_by", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "job-queue",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "job-matches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "user_id", "order": "ASCENDING" },
        { "fieldPath": "match_score", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "generation-history",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "user_id", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## Acceptance Criteria

- [ ] **Collections documented**: FIRESTORE_SCHEMA.md created with all collection schemas
- [ ] **Firestore service created**: Type-safe service layer for database operations
- [ ] **Security rules written**: firestore.rules covers all collections
- [ ] **Security rules tested**: All test cases pass
- [ ] **Indexes defined**: firestore.indexes.json includes all required indexes
- [ ] **Configuration deployed**: Rules and indexes deployed to staging
- [ ] **Integration tests pass**: Firestore operations work end-to-end
- [ ] **No index errors**: All queries execute without "index required" errors

---

## Testing

### Test Commands

```bash
# Build project
npm run build

# Run unit tests
npm test

# Test Firestore rules locally
firebase emulators:start --only firestore
firebase emulators:exec --only firestore "npm test"

# Deploy rules to staging
firebase use staging
firebase deploy --only firestore:rules,firestore:indexes
```

### Manual Testing

```bash
# Step 1: Start Firestore emulator
firebase emulators:start --only firestore

# Step 2: Test Firestore service
node -e "
const { FirestoreService } = require('./dist/services/firestore.service.js');
const service = new FirestoreService();
service.createDocument('job-queue', {
  type: 'job',
  status: 'pending',
  url: 'https://test.com'
}).then(id => console.log('Created:', id));
"

# Step 3: Test security rules in Firebase console
# Go to Firestore → Rules → Rules Playground
# Test: User can read their own job-queue items
# Test: User cannot read other users' job-queue items
# Test: Only editors can write to job-finder-config

# Step 4: Verify indexes
firebase use staging
firebase deploy --only firestore:indexes
# Check Firebase console → Firestore → Indexes
```

---

## Commit Message Template

```
feat(firestore): set up Firestore integration with rules and indexes

Configure complete Firestore database setup including collection schemas,
security rules, composite indexes, and type-safe service layer. Ensures
secure data access and performant queries for all backend operations.

Key changes:
- Document Firestore collection schemas in FIRESTORE_SCHEMA.md
- Create FirestoreService for type-safe database operations
- Write security rules for all collections (user-scoped and editor-only)
- Define composite indexes for common query patterns
- Add integration tests for Firestore operations
- Deploy rules and indexes to staging environment

Testing:
- All security rule tests pass
- Integration tests verify CRUD operations
- Indexes deployed successfully
- No "index required" errors on queries
- Users can only access their own data

Closes #6
```

---

## Related Issues

- **Depends on**: #1, #2, #4 (Project setup, infrastructure, Firebase config)
- **Blocks**: #5 (Job queue functions), #8 (Generator functions), #9 (Content items)
- **Related**: BACKEND_MIGRATION_PLAN.md Phase 2, Task 2.2

---

## Resources

### Documentation
- **Firestore Documentation**: https://firebase.google.com/docs/firestore
- **Security Rules**: https://firebase.google.com/docs/firestore/security/get-started
- **Indexes**: https://firebase.google.com/docs/firestore/query-data/indexing

### External References
- **Rules Testing**: https://firebase.google.com/docs/rules/unit-tests
- **Data Modeling**: https://firebase.google.com/docs/firestore/manage-data/structure-data

---

## Success Metrics

**How we'll measure success**:
- Zero unauthorized data access (security rules working)
- < 100ms query response time for indexed queries
- All required queries work without manual index creation
- 100% test coverage for Firestore service methods

---

## Notes

**Questions? Need clarification?**
- Comment on this issue with specific questions
- Tag @PM for guidance
- Reference Firestore documentation for best practices

**Implementation Tips**:
- Start with security rules - test thoroughly before deploying
- Use Firestore emulator for local testing
- Create indexes before they're needed (deploy early)
- Document all collections with field types and purposes
- Use transactions for operations requiring atomicity
- Batch writes when creating multiple documents
- Consider pagination for large result sets

**Common Pitfalls**:
- Forgetting to create indexes for compound queries
- Security rules too permissive (always test edge cases)
- Not handling document not found errors
- Not using transactions for atomic operations
- Hardcoding collection names (use constants)

---

**Created**: 2025-10-20
**Created By**: PM
**Last Updated**: 2025-10-20
**Status**: Todo
