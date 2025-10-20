# PHASE-2-5 — Migrate Content Items Functions from Portfolio

> **Context**: See [API.md](../../API.md) for content items API and [README.md](../../README.md) for data architecture
> **Architecture**: Express-style HTTP functions for CRUD operations on content items and experiences

---

## Issue Metadata

```yaml
Title: PHASE-2-5 — Migrate Content Items Functions from Portfolio
Labels: priority-p1, repository-backend, type-migration, status-todo, phase-2
Assignee: Worker A
Priority: P1-High
Estimated Effort: 6-8 hours
Repository: job-finder-BE
```

---

## Summary

**Problem**: Content items and experience management functions currently exist in the portfolio repository and need to be migrated to job-finder-BE. These functions allow users to manage their skills, projects, work experience, and achievements that are used in AI document generation.

**Goal**: Migrate all content items and experience management functions from portfolio, including CRUD operations, validation, and Firestore integration for user-specific content.

**Impact**: Enables users to build and maintain their professional profile, which is essential for generating customized resumes and cover letters.

---

## Architecture References

> **📚 Read these docs first for context:**

- **[API.md](../../API.md)** - Content items API specifications
- **[BACKEND_MIGRATION_PLAN.md](../../../docs/architecture/BACKEND_MIGRATION_PLAN.md)** - Phase 2, Task 2.5
- **Portfolio Source**: `/home/jdubz/Development/portfolio/functions/src/` (content-items, experience)

**Key concepts to understand**:
- Content Item Types: Skills, projects, achievements, certifications
- Experience Entries: Detailed work history with dates and descriptions
- User Isolation: Users can only access their own content

---

## Tasks

### Phase 1: Migrate Content Items Functions
1. **Migrate manageContentItems HTTP function**
   - What: Copy main content items management function with routing
   - Where: `src/content-items/manage-content-items.ts`
   - Why: Handles GET, POST, PUT, DELETE for content items
   - Test: All CRUD operations work for content items

2. **Implement GET content items**
   - What: Retrieve all content items for authenticated user
   - Where: `src/content-items/get-content-items.ts`
   - Why: Frontend displays user's skills, projects, etc.
   - Test: Returns filtered content by user and type

3. **Implement POST content item**
   - What: Create new content item
   - Where: `src/content-items/create-content-item.ts`
   - Why: Users add new skills, projects, achievements
   - Test: Creates item with validation

4. **Implement PUT content item**
   - What: Update existing content item
   - Where: `src/content-items/update-content-item.ts`
   - Why: Users edit their content
   - Test: Updates item with validation

5. **Implement DELETE content item**
   - What: Delete content item
   - Where: `src/content-items/delete-content-item.ts`
   - Why: Users remove outdated content
   - Test: Deletes item and returns success

### Phase 2: Migrate Experience Functions
6. **Migrate experience management**
   - What: Copy experience-specific CRUD operations
   - Where: `src/experiences/manage-experiences.ts`
   - Why: Work experience has different schema than content items
   - Test: All CRUD operations work for experiences

### Phase 3: Service Layer and Validation
7. **Create ContentItemService**
   - What: Extract business logic into service layer
   - Where: `src/services/content-item.service.ts`
   - Why: Reusable logic for content operations
   - Test: Service methods work independently

8. **Create ExperienceService**
   - What: Extract experience business logic
   - Where: `src/services/experience.service.ts`
   - Why: Separate concerns for experience management
   - Test: Service handles experience CRUD

9. **Add validation schemas**
   - What: Create validation for content items and experiences
   - Where: `src/validation/content.schemas.ts`
   - Why: Ensures data integrity
   - Test: Validation rejects invalid data

---

## Technical Details

### Files to Migrate/Create

```
COPY FROM PORTFOLIO:
- portfolio/functions/src/content-items.ts → src/content-items/
- portfolio/functions/src/experience.ts → src/experiences/
- portfolio/functions/src/services/content-item.service.ts → src/services/
- portfolio/functions/src/services/experience.service.ts → src/services/

CREATE NEW:
- src/content-items/manage-content-items.ts - Main HTTP function with routing
- src/content-items/get-content-items.ts - Retrieve content items
- src/content-items/create-content-item.ts - Create content item
- src/content-items/update-content-item.ts - Update content item
- src/content-items/delete-content-item.ts - Delete content item
- src/experiences/manage-experiences.ts - Experience CRUD operations
- src/services/content-item.service.ts - Content item business logic
- src/services/experience.service.ts - Experience business logic
- src/validation/content.schemas.ts - Validation schemas
- src/types/content.types.ts - TypeScript types
- src/__tests__/content-items.test.ts - Unit tests

MODIFY:
- src/index.ts - Export content management functions
```

### Key Implementation Notes

**Manage Content Items Function**:
```typescript
// src/content-items/manage-content-items.ts
import * as functions from 'firebase-functions';
import * as express from 'express';
import * as cors from 'cors';
import { ContentItemService } from '@/services/content-item.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { validateContentItem } from '@/validation/content.schemas';

const app = express();
app.use(cors({ origin: true }));
app.use(authMiddleware);

// GET all content items for user
app.get('/', async (req, res) => {
  const userId = req.user.uid;
  const type = req.query.type as string | undefined;

  const service = new ContentItemService();
  const items = await service.getContentItems(userId, type);

  res.json({ success: true, data: items });
});

// POST create content item
app.post('/', async (req, res) => {
  const userId = req.user.uid;
  const { error, value } = validateContentItem(req.body);

  if (error) {
    return res.status(400).json({ success: false, error: error.message });
  }

  const service = new ContentItemService();
  const item = await service.createContentItem({ ...value, userId });

  res.json({ success: true, data: item });
});

// PUT update content item
app.put('/:id', async (req, res) => {
  const userId = req.user.uid;
  const itemId = req.params.id;
  const { error, value } = validateContentItem(req.body);

  if (error) {
    return res.status(400).json({ success: false, error: error.message });
  }

  const service = new ContentItemService();
  await service.updateContentItem(itemId, userId, value);

  res.json({ success: true, message: 'Content item updated' });
});

// DELETE content item
app.delete('/:id', async (req, res) => {
  const userId = req.user.uid;
  const itemId = req.params.id;

  const service = new ContentItemService();
  await service.deleteContentItem(itemId, userId);

  res.json({ success: true, message: 'Content item deleted' });
});

export const manageContentItems = functions.https.onRequest(app);
```

**Content Item Service**:
```typescript
// src/services/content-item.service.ts
import { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/database';
import { ContentItem, ContentItemType } from '@/types/content.types';

export class ContentItemService {
  constructor(private db: Firestore) {}

  async getContentItems(userId: string, type?: ContentItemType): Promise<ContentItem[]> {
    let query = this.db
      .collection(COLLECTIONS.CONTENT_ITEMS)
      .where('userId', '==', userId);

    if (type) {
      query = query.where('type', '==', type);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentItem));
  }

  async createContentItem(data: Omit<ContentItem, 'id'>): Promise<ContentItem> {
    const contentItem = {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await this.db.collection(COLLECTIONS.CONTENT_ITEMS).add(contentItem);
    return { id: docRef.id, ...contentItem };
  }

  async updateContentItem(id: string, userId: string, data: Partial<ContentItem>): Promise<void> {
    const docRef = this.db.collection(COLLECTIONS.CONTENT_ITEMS).doc(id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.userId !== userId) {
      throw new Error('Content item not found or unauthorized');
    }

    await docRef.update({
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }

  async deleteContentItem(id: string, userId: string): Promise<void> {
    const docRef = this.db.collection(COLLECTIONS.CONTENT_ITEMS).doc(id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.userId !== userId) {
      throw new Error('Content item not found or unauthorized');
    }

    await docRef.delete();
  }
}
```

**Experience Service**:
```typescript
// src/services/experience.service.ts
import { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/database';
import { Experience } from '@/types/content.types';

export class ExperienceService {
  constructor(private db: Firestore) {}

  async getExperiences(userId: string): Promise<Experience[]> {
    const snapshot = await this.db
      .collection(COLLECTIONS.EXPERIENCES)
      .where('userId', '==', userId)
      .orderBy('startDate', 'desc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Experience));
  }

  async createExperience(data: Omit<Experience, 'id'>): Promise<Experience> {
    const experience = {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await this.db.collection(COLLECTIONS.EXPERIENCES).add(experience);
    return { id: docRef.id, ...experience };
  }

  async updateExperience(id: string, userId: string, data: Partial<Experience>): Promise<void> {
    const docRef = this.db.collection(COLLECTIONS.EXPERIENCES).doc(id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.userId !== userId) {
      throw new Error('Experience not found or unauthorized');
    }

    await docRef.update({
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }

  async deleteExperience(id: string, userId: string): Promise<void> {
    const docRef = this.db.collection(COLLECTIONS.EXPERIENCES).doc(id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.userId !== userId) {
      throw new Error('Experience not found or unauthorized');
    }

    await docRef.delete();
  }
}
```

**Validation Schemas**:
```typescript
// src/validation/content.schemas.ts
import Joi from 'joi';

export const contentItemSchema = Joi.object({
  type: Joi.string().valid('skill', 'project', 'achievement', 'certification').required(),
  title: Joi.string().max(200).required(),
  description: Joi.string().max(2000).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  skills: Joi.array().items(Joi.string().max(50)).max(50).optional(),
  url: Joi.string().uri().optional(),
});

export const experienceSchema = Joi.object({
  company: Joi.string().max(200).required(),
  role: Joi.string().max(200).required(),
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().allow(null).optional(),
  current: Joi.boolean().optional(),
  description: Joi.string().max(5000).optional(),
  achievements: Joi.array().items(Joi.string().max(500)).max(20).optional(),
  skills: Joi.array().items(Joi.string().max(50)).max(50).optional(),
});

export function validateContentItem(data: any) {
  return contentItemSchema.validate(data);
}

export function validateExperience(data: any) {
  return experienceSchema.validate(data);
}
```

---

## Acceptance Criteria

- [ ] **GET content items works**: Can retrieve all content items for user
- [ ] **POST content item works**: Can create new content items with validation
- [ ] **PUT content item works**: Can update existing content items
- [ ] **DELETE content item works**: Can delete content items
- [ ] **Experience CRUD works**: All operations work for experiences
- [ ] **User isolation enforced**: Users can only access their own content
- [ ] **Validation working**: Invalid data rejected with clear errors
- [ ] **Service layer complete**: Business logic in service classes
- [ ] **Tests passing**: Unit tests cover all CRUD operations
- [ ] **Functions deployed**: All content functions in Firebase console

---

## Testing

### Test Commands

```bash
# Build
npm run build

# Run tests
npm test content-items.test.ts

# Start emulator
npm run serve

# Deploy to staging
npm run deploy:staging
```

### Manual Testing

```bash
# Step 1: Create content item
curl -X POST http://localhost:5001/{project-id}/us-central1/manageContentItems \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "skill",
    "title": "React.js",
    "description": "Expert in React development",
    "skills": ["JavaScript", "TypeScript", "React"],
    "tags": ["frontend", "web"]
  }'

# Step 2: Get all content items
curl http://localhost:5001/{project-id}/us-central1/manageContentItems \
  -H "Authorization: Bearer $FIREBASE_TOKEN"

# Step 3: Get specific type
curl "http://localhost:5001/{project-id}/us-central1/manageContentItems?type=skill" \
  -H "Authorization: Bearer $FIREBASE_TOKEN"

# Step 4: Update content item
curl -X PUT http://localhost:5001/{project-id}/us-central1/manageContentItems/{item-id} \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated description"
  }'

# Step 5: Delete content item
curl -X DELETE http://localhost:5001/{project-id}/us-central1/manageContentItems/{item-id} \
  -H "Authorization: Bearer $FIREBASE_TOKEN"
```

---

## Commit Message Template

```
feat(content): migrate content items and experience functions

Migrate complete content management system from portfolio including CRUD
operations for content items (skills, projects, achievements) and work
experiences. Implements user-scoped access control and validation.

Key changes:
- Migrate manageContentItems HTTP function with Express routing
- Implement GET, POST, PUT, DELETE for content items
- Migrate experience management functions
- Create ContentItemService and ExperienceService
- Add validation schemas for content and experience data
- Enforce user isolation (users access only their content)
- Write comprehensive unit tests

Testing:
- All CRUD operations work for content items and experiences
- User isolation enforced (cannot access others' content)
- Validation rejects invalid data
- Unit tests pass for all operations

Closes #9
```

---

## Related Issues

- **Depends on**: #2, #6 (Infrastructure, Firestore)
- **Blocks**: #8 (Generator needs content items)
- **Related**: API.md content endpoints

---

## Resources

### Documentation
- **Express.js**: https://expressjs.com/
- **Firestore Queries**: https://firebase.google.com/docs/firestore/query-data/queries
- **Joi Validation**: https://joi.dev/api/

---

## Success Metrics

**How we'll measure success**:
- All CRUD operations functional for content items and experiences
- < 200ms response time for GET operations
- < 400ms response time for write operations
- 100% user isolation (no cross-user access)
- Validation catches all invalid inputs

---

## Notes

**Implementation Tips**:
- Use Express router for clean RESTful endpoints
- Enforce user ID matching in all operations
- Add indexes for userId queries in Firestore
- Consider pagination for large content collections
- Validate dates for experiences (end date after start date)
- Allow null end date for current positions
- Test edge cases (delete non-existent item, update others' content)

---

**Created**: 2025-10-20
**Created By**: PM
**Last Updated**: 2025-10-20
**Status**: Todo
