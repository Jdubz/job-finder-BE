# PHASE-2-3 — Implement Configuration API

> **Context**: See [API.md](../../API.md) for configuration API specifications
> **Architecture**: Firebase callable functions for managing system configuration

---

## Issue Metadata

```yaml
Title: PHASE-2-3 — Implement Configuration API
Labels: priority-p1, repository-backend, type-feature, status-todo, phase-2
Assignee: Worker A
Priority: P1-High
Estimated Effort: 6-8 hours
Repository: job-finder-BE
```

---

## Summary

**Problem**: The job-finder application needs API endpoints to manage configuration settings including stop lists (excluded companies/keywords/domains), AI settings (model, thresholds, budget), and queue settings (retries, timeouts). Configuration is currently managed manually or doesn't exist.

**Goal**: Implement complete configuration management API with CRUD endpoints for stop lists, AI settings, and queue settings. Include validation, editor-only access control, and proper Firestore integration.

**Impact**: Enables frontend configuration pages, allows dynamic system tuning without code changes, and provides audit trail for configuration changes.

---

## Architecture References

> **📚 Read these docs first for context:**

- **[API.md](../../API.md)** - Configuration API specifications (stop-list, ai-settings, queue-settings endpoints)
- **[README.md](../../README.md)** - Configuration management overview
- **[BACKEND_MIGRATION_PLAN.md](../../../docs/architecture/BACKEND_MIGRATION_PLAN.md)** - Phase 2, Task 2.3

**Key concepts to understand**:
- Configuration Storage: Firestore `job-finder-config` collection
- Editor-Only Access: Custom claims or email verification required
- Validation: Strict input validation for configuration values

---

## Tasks

### Phase 1: Stop List API
1. **Implement getStopList function**
   - What: Retrieve current stop list configuration
   - Where: `src/config-api/get-stop-list.ts`
   - Why: Frontend needs to display current exclusions
   - Test: Function returns excluded companies, keywords, domains

2. **Implement updateStopList function**
   - What: Update stop list with new exclusions
   - Where: `src/config-api/update-stop-list.ts`
   - Why: Editors need to manage blocked companies/keywords
   - Test: Function validates and updates stop list

3. **Implement checkStopList function**
   - What: Check if job/company would be blocked
   - Where: `src/config-api/check-stop-list.ts`
   - Why: Users can verify before submitting
   - Test: Function correctly identifies blocked items

### Phase 2: AI Settings API
4. **Implement getAISettings function**
   - What: Retrieve AI configuration (provider, model, thresholds)
   - Where: `src/config-api/get-ai-settings.ts`
   - Why: Frontend displays current AI configuration
   - Test: Function returns AI settings

5. **Implement updateAISettings function**
   - What: Update AI provider, model, match score threshold, budget
   - Where: `src/config-api/update-ai-settings.ts`
   - Why: Editors tune AI behavior and costs
   - Test: Function validates and updates settings

### Phase 3: Queue Settings API
6. **Implement getQueueSettings function**
   - What: Retrieve queue configuration (retries, timeouts)
   - Where: `src/config-api/get-queue-settings.ts`
   - Why: Frontend displays queue behavior settings
   - Test: Function returns queue settings

7. **Implement updateQueueSettings function**
   - What: Update max retries, retry delay, processing timeout
   - Where: `src/config-api/update-queue-settings.ts`
   - Why: Editors optimize queue processing
   - Test: Function validates and updates settings

### Phase 4: Service Layer and Validation
8. **Create ConfigService**
   - What: Extract business logic into service layer
   - Where: `src/services/config.service.ts`
   - Why: Reusable logic for configuration operations
   - Test: Service methods work independently

9. **Add validation schemas**
   - What: Create Joi/Zod schemas for all config types
   - Where: `src/validation/config.schemas.ts`
   - Why: Ensures invalid configuration can't be saved
   - Test: Validation rejects invalid inputs

---

## Technical Details

### Files to Create

```
CREATE:
- src/config-api/get-stop-list.ts - Retrieve stop list
- src/config-api/update-stop-list.ts - Update stop list
- src/config-api/check-stop-list.ts - Check if item blocked
- src/config-api/get-ai-settings.ts - Retrieve AI settings
- src/config-api/update-ai-settings.ts - Update AI settings
- src/config-api/get-queue-settings.ts - Retrieve queue settings
- src/config-api/update-queue-settings.ts - Update queue settings
- src/services/config.service.ts - Configuration business logic
- src/validation/config.schemas.ts - Validation schemas
- src/types/config.types.ts - TypeScript type definitions
- src/__tests__/config-api.test.ts - Unit tests

MODIFY:
- src/index.ts - Export all config functions
```

### Key Implementation Notes

**Stop List Function**:
```typescript
// src/config-api/update-stop-list.ts
import * as functions from 'firebase-functions';
import { ConfigService } from '@/services/config.service';
import { stopListSchema } from '@/validation/config.schemas';
import { logger } from '@/utils/logger';

export const updateStopList = functions.https.onCall(async (data, context) => {
  // Require editor role
  if (!context.auth || !isEditor(context.auth)) {
    throw new functions.https.HttpsError('permission-denied', 'Editor role required');
  }

  // Validate input
  const { error, value } = stopListSchema.validate(data);
  if (error) {
    throw new functions.https.HttpsError('invalid-argument', error.message);
  }

  // Update configuration
  const service = new ConfigService();
  await service.updateStopList({
    excludedCompanies: value.excludedCompanies || [],
    excludedKeywords: value.excludedKeywords || [],
    excludedDomains: value.excludedDomains || [],
    updatedBy: context.auth.token.email,
    updatedAt: new Date().toISOString(),
  });

  logger.info('Stop list updated', { updatedBy: context.auth.uid });
  return { success: true, message: 'Stop list updated successfully' };
});
```

**Config Service**:
```typescript
// src/services/config.service.ts
import { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/database';

export class ConfigService {
  private configCollection = 'job-finder-config';

  constructor(private db: Firestore) {}

  async getStopList(): Promise<StopListConfig> {
    const doc = await this.db.collection(this.configCollection).doc('stop-list').get();
    return doc.exists ? (doc.data() as StopListConfig) : this.getDefaultStopList();
  }

  async updateStopList(stopList: StopListConfig): Promise<void> {
    await this.db.collection(this.configCollection).doc('stop-list').set(stopList, { merge: true });
  }

  async checkStopList(companyName: string, url: string): Promise<{ isExcluded: boolean; reason: string | null }> {
    const stopList = await this.getStopList();

    // Check domain
    const domain = new URL(url).hostname.replace('www.', '');
    if (stopList.excludedDomains?.includes(domain)) {
      return { isExcluded: true, reason: 'domain' };
    }

    // Check company name
    if (stopList.excludedCompanies?.includes(companyName.toLowerCase())) {
      return { isExcluded: true, reason: 'company' };
    }

    // Check keywords
    const lowerCompanyName = companyName.toLowerCase();
    for (const keyword of stopList.excludedKeywords || []) {
      if (lowerCompanyName.includes(keyword.toLowerCase())) {
        return { isExcluded: true, reason: 'keyword' };
      }
    }

    return { isExcluded: false, reason: null };
  }

  async getAISettings(): Promise<AISettings> {
    const doc = await this.db.collection(this.configCollection).doc('ai-settings').get();
    return doc.exists ? (doc.data() as AISettings) : this.getDefaultAISettings();
  }

  async updateAISettings(settings: AISettings): Promise<void> {
    await this.db.collection(this.configCollection).doc('ai-settings').set(settings, { merge: true });
  }

  async getQueueSettings(): Promise<QueueSettings> {
    const doc = await this.db.collection(this.configCollection).doc('queue-settings').get();
    return doc.exists ? (doc.data() as QueueSettings) : this.getDefaultQueueSettings();
  }

  async updateQueueSettings(settings: QueueSettings): Promise<void> {
    await this.db.collection(this.configCollection).doc('queue-settings').set(settings, { merge: true });
  }
}
```

**Validation Schemas**:
```typescript
// src/validation/config.schemas.ts
import Joi from 'joi';

export const stopListSchema = Joi.object({
  excludedCompanies: Joi.array().items(Joi.string().max(200)).max(1000).optional(),
  excludedKeywords: Joi.array().items(Joi.string().max(200)).max(1000).optional(),
  excludedDomains: Joi.array().items(Joi.string().max(200)).max(1000).optional(),
});

export const aiSettingsSchema = Joi.object({
  provider: Joi.string().valid('claude', 'openai', 'gemini').required(),
  model: Joi.string().required(),
  minMatchScore: Joi.number().integer().min(0).max(100).required(),
  costBudgetDaily: Joi.number().min(0).required(),
});

export const queueSettingsSchema = Joi.object({
  maxRetries: Joi.number().integer().min(1).max(10).required(),
  retryDelaySeconds: Joi.number().integer().min(0).required(),
  processingTimeout: Joi.number().integer().min(60).required(),
});
```

**API Endpoints Created**:
- `getStopList` - GET stop list configuration
- `updateStopList` - PUT stop list configuration
- `checkStopList` - POST check if item blocked
- `getAISettings` - GET AI settings
- `updateAISettings` - PUT AI settings
- `getQueueSettings` - GET queue settings
- `updateQueueSettings` - PUT queue settings

---

## Acceptance Criteria

- [ ] **Stop list API works**: Can get, update, and check stop list
- [ ] **AI settings API works**: Can get and update AI configuration
- [ ] **Queue settings API works**: Can get and update queue configuration
- [ ] **Validation enforced**: Invalid inputs rejected with clear errors
- [ ] **Editor-only access**: Non-editors cannot update configuration
- [ ] **Audit trail**: Updates include updatedBy and updatedAt fields
- [ ] **Service layer complete**: ConfigService handles all business logic
- [ ] **Tests passing**: Unit tests cover all functions and edge cases
- [ ] **Documentation updated**: API.md reflects all endpoints

---

## Testing

### Test Commands

```bash
# Build TypeScript
npm run build

# Run unit tests
npm test config-api.test.ts

# Start emulator
npm run serve

# Deploy to staging
npm run deploy:staging
```

### Manual Testing

```bash
# Step 1: Start emulator
npm run serve

# Step 2: Get stop list (requires auth token)
curl -X POST http://localhost:5001/{project-id}/us-central1/getStopList \
  -H "Authorization: Bearer $EDITOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data": {}}'

# Step 3: Update stop list
curl -X POST http://localhost:5001/{project-id}/us-central1/updateStopList \
  -H "Authorization: Bearer $EDITOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "excludedCompanies": ["Bad Company Inc"],
      "excludedKeywords": ["unpaid", "commission-only"],
      "excludedDomains": ["spam.com"]
    }
  }'

# Step 4: Check stop list
curl -X POST http://localhost:5001/{project-id}/us-central1/checkStopList \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "companyName": "Bad Company Inc",
      "url": "https://badcompany.com/job"
    }
  }'
# Should return: { "isExcluded": true, "reason": "company" }

# Step 5: Update AI settings
curl -X POST http://localhost:5001/{project-id}/us-central1/updateAISettings \
  -H "Authorization: Bearer $EDITOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "provider": "claude",
      "model": "claude-3-5-sonnet-20241022",
      "minMatchScore": 75,
      "costBudgetDaily": 15.0
    }
  }'

# Step 6: Verify in Firestore
# Check Firebase console → Firestore → job-finder-config collection
```

---

## Commit Message Template

```
feat(config): implement configuration management API

Implement complete configuration API for managing stop lists, AI settings,
and queue settings. Includes validation, editor-only access control, audit
trail, and service layer for business logic.

Key changes:
- Implement stop list API (get, update, check)
- Implement AI settings API (get, update)
- Implement queue settings API (get, update)
- Create ConfigService for configuration business logic
- Add validation schemas for all config types
- Enforce editor-only access for updates
- Add audit trail (updatedBy, updatedAt)
- Write comprehensive unit tests

Testing:
- All configuration endpoints work in emulator
- Validation rejects invalid inputs
- Non-editors cannot update configuration
- Configuration stored correctly in Firestore
- Unit tests pass for all functions

Closes #7
```

---

## Related Issues

- **Depends on**: #2 (Infrastructure), #6 (Firestore integration)
- **Blocks**: Frontend configuration pages
- **Related**: API.md configuration endpoints

---

## Resources

### Documentation
- **Joi Validation**: https://joi.dev/api/
- **Firestore Merge**: https://firebase.google.com/docs/firestore/manage-data/add-data#set_a_document
- **API Reference**: [API.md](../../API.md) - Configuration section

---

## Success Metrics

**How we'll measure success**:
- All 7 configuration endpoints operational
- < 300ms response time for get operations
- < 500ms response time for update operations
- 100% validation coverage (all invalid inputs rejected)
- Configuration changes logged with user and timestamp

---

## Notes

**Implementation Tips**:
- Use merge: true when updating Firestore to preserve other fields
- Validate array lengths (prevent excessive stop list entries)
- Log all configuration changes for audit
- Cache configuration in memory to reduce Firestore reads
- Provide default configurations if documents don't exist
- Test editor role checking thoroughly

**Editor Role Detection**:
```typescript
function isEditor(auth: functions.https.CallableContext['auth']): boolean {
  return auth.token.editor === true || auth.token.email_verified === true;
}
```

---

**Created**: 2025-10-20
**Created By**: PM
**Last Updated**: 2025-10-20
**Status**: Todo
