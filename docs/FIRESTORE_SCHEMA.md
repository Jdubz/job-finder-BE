# Firestore Database Schema

This document defines the schema for all Firestore collections in the Job Finder application.

## Collections Overview

The database uses the following top-level collections:

1. **job-queue** - Job processing queue items
2. **job-matches** - AI-analyzed job matches for users
3. **job-finder-config** - System-wide configuration
4. **content-items** - User resume content (skills, experience summaries)
5. **experiences** - Detailed work experience entries
6. **generation-history** - AI document generation history
7. **user-defaults** - User preferences and default settings

---

## Collection: `job-queue`

Queue items for job processing tasks (scraping, analyzing, matching).

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Type of job: 'job', 'scrape', or 'company' |
| `status` | string | Yes | Current status: 'pending', 'processing', 'completed', 'failed' |
| `url` | string | Yes | URL of the job posting or company careers page |
| `company_name` | string | No | Name of the company (optional, extracted from URL if missing) |
| `submitted_by` | string | Yes | User ID of the person who submitted the job |
| `created_at` | timestamp | Yes | When the job was added to the queue |
| `updated_at` | timestamp | Yes | Last update timestamp |
| `started_at` | timestamp | No | When processing started |
| `completed_at` | timestamp | No | When processing completed |
| `retry_count` | number | No | Number of retry attempts (default: 0) |
| `error` | string | No | Error message if status is 'failed' |
| `metadata` | object | No | Additional metadata specific to job type |

### Indexes

- `submitted_by` (ASC) + `created_at` (DESC) - User's queue history
- `status` (ASC) + `created_at` (ASC) - Processing queue order

### Security Rules

- Users can read their own submissions (`submitted_by == request.auth.uid`)
- Users can create items with their own `submitted_by`
- Only editors can update/delete

---

## Collection: `job-matches`

AI-analyzed job matches for users.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | string | Yes | Reference to job-queue document ID |
| `user_id` | string | Yes | User ID this match is for |
| `match_score` | number | Yes | AI-calculated match score (0-100) |
| `title` | string | Yes | Job title |
| `company` | string | Yes | Company name |
| `url` | string | Yes | Job posting URL |
| `location` | string | No | Job location |
| `salary_range` | object | No | Salary information: { min, max, currency } |
| `job_type` | string | No | Full-time, part-time, contract, etc. |
| `remote` | boolean | No | Whether the job is remote |
| `description` | string | No | Job description text |
| `requirements` | string[] | No | List of job requirements |
| `skills_matched` | string[] | No | User skills that match this job |
| `analysis` | object | Yes | AI analysis with reasoning for match score |
| `created_at` | timestamp | Yes | When the match was created |
| `updated_at` | timestamp | Yes | Last update timestamp |
| `viewed_at` | timestamp | No | When user last viewed this match |
| `status` | string | Yes | 'new', 'viewed', 'applied', 'rejected', 'archived' |

### Indexes

- `user_id` (ASC) + `match_score` (DESC) - User's best matches
- `user_id` (ASC) + `created_at` (DESC) - User's recent matches
- `user_id` (ASC) + `status` (ASC) + `match_score` (DESC) - Filter by status

### Security Rules

- Users can read only their own matches (`user_id == request.auth.uid`)
- Only backend can write (users cannot create/update/delete directly)

---

## Collection: `job-finder-config`

System-wide configuration documents.

### Documents

#### Document: `stop-list`

Companies and keywords to exclude from job searches.

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `excludedCompanies` | string[] | Yes | List of company names to exclude |
| `excludedKeywords` | string[] | Yes | List of keywords to exclude from job titles/descriptions |
| `updated_at` | timestamp | Yes | Last update timestamp |
| `updated_by` | string | Yes | User ID who last updated |

#### Document: `ai-settings`

AI model and prompt configuration.

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | Yes | OpenAI model to use (e.g., 'gpt-4', 'gpt-3.5-turbo') |
| `temperature` | number | Yes | Model temperature (0.0-1.0) |
| `maxTokens` | number | Yes | Maximum tokens for completion |
| `systemPrompt` | string | Yes | System prompt for AI analysis |
| `minMatchScore` | number | Yes | Minimum score to create a match (0-100) |
| `updated_at` | timestamp | Yes | Last update timestamp |
| `updated_by` | string | Yes | User ID who last updated |

#### Document: `queue-settings`

Job queue processing configuration.

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `maxRetries` | number | Yes | Maximum retry attempts for failed jobs |
| `retryDelay` | number | Yes | Delay between retries (seconds) |
| `batchSize` | number | Yes | Number of jobs to process in parallel |
| `timeout` | number | Yes | Job processing timeout (seconds) |
| `updated_at` | timestamp | Yes | Last update timestamp |
| `updated_by` | string | Yes | User ID who last updated |

### Security Rules

- All authenticated users can read configuration
- Only editors can write

---

## Collection: `content-items`

User's resume content (skills, experience summaries, achievements).

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | User ID who owns this content |
| `type` | string | Yes | Type: 'skill', 'summary', 'achievement', 'certification' |
| `title` | string | Yes | Title or name of the item |
| `description` | string | No | Detailed description |
| `tags` | string[] | No | Categorization tags |
| `skills` | string[] | No | Related skills (for non-skill items) |
| `level` | string | No | Proficiency level: 'beginner', 'intermediate', 'advanced', 'expert' |
| `years_experience` | number | No | Years of experience with this skill/area |
| `created_at` | timestamp | Yes | When the item was created |
| `updated_at` | timestamp | Yes | Last update timestamp |
| `order` | number | No | Display order (for sorting) |

### Indexes

- `user_id` (ASC) + `type` (ASC) + `order` (ASC) - User's organized content
- `user_id` (ASC) + `created_at` (DESC) - User's recent items

### Security Rules

- Users can read/write only their own items (`user_id == request.auth.uid`)

---

## Collection: `experiences`

Detailed work experience entries for user's resume.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | User ID who owns this experience |
| `company` | string | Yes | Company name |
| `role` | string | Yes | Job title/role |
| `start_date` | timestamp | Yes | Employment start date |
| `end_date` | timestamp | No | Employment end date (null for current) |
| `current` | boolean | Yes | Whether this is current employment |
| `location` | string | No | Job location |
| `description` | string | No | Overall role description |
| `achievements` | string[] | No | List of achievements and responsibilities |
| `skills` | string[] | No | Skills used in this role |
| `technologies` | string[] | No | Technologies/tools used |
| `created_at` | timestamp | Yes | When the entry was created |
| `updated_at` | timestamp | Yes | Last update timestamp |
| `order` | number | No | Display order (for sorting, typically reverse chronological) |

### Indexes

- `user_id` (ASC) + `start_date` (DESC) - User's experience chronologically
- `user_id` (ASC) + `current` (ASC) + `start_date` (DESC) - Current/past jobs

### Security Rules

- Users can read/write only their own experiences (`user_id == request.auth.uid`)

---

## Collection: `generation-history`

History of AI-generated documents (cover letters, resumes).

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | User ID who requested the generation |
| `type` | string | Yes | Document type: 'cover_letter', 'resume', 'linkedin_summary' |
| `job_match_id` | string | No | Reference to job-matches document (if applicable) |
| `document_url` | string | Yes | Cloud Storage URL of generated document |
| `document_format` | string | Yes | Format: 'pdf', 'docx', 'txt', 'html' |
| `template_used` | string | No | Template identifier used for generation |
| `ai_model` | string | Yes | AI model used (e.g., 'gpt-4') |
| `generation_time` | number | Yes | Generation time in milliseconds |
| `created_at` | timestamp | Yes | When the document was generated |
| `metadata` | object | No | Additional metadata about generation |

### Indexes

- `user_id` (ASC) + `created_at` (DESC) - User's generation history
- `user_id` (ASC) + `type` (ASC) + `created_at` (DESC) - By document type

### Security Rules

- Users can read only their own history (`user_id == request.auth.uid`)
- Only backend can write

---

## Collection: `user-defaults`

User preferences and default settings.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | User ID (also used as document ID) |
| `default_ai_model` | string | No | Preferred AI model for generations |
| `default_template` | string | No | Default document template |
| `notification_preferences` | object | No | Notification settings |
| `job_preferences` | object | No | Preferred job types, locations, remote work, etc. |
| `created_at` | timestamp | Yes | When preferences were first set |
| `updated_at` | timestamp | Yes | Last update timestamp |

### Security Rules

- Users can read/write only their own preferences (document ID == `request.auth.uid`)

---

## Data Types

### Timestamp
Firestore timestamp representing date and time in UTC.

### Object Types

#### salary_range
```typescript
{
  min?: number;
  max?: number;
  currency: string; // e.g., 'USD', 'EUR'
  period?: string; // e.g., 'year', 'hour'
}
```

#### analysis (in job-matches)
```typescript
{
  reasoning: string;
  pros: string[];
  cons: string[];
  fit_score_breakdown: {
    skills: number;
    experience: number;
    location: number;
    culture: number;
  };
}
```

#### notification_preferences
```typescript
{
  email: boolean;
  push: boolean;
  match_threshold: number; // Only notify for matches above this score
  frequency: string; // 'immediate', 'daily', 'weekly'
}
```

#### job_preferences
```typescript
{
  job_types: string[]; // e.g., ['full-time', 'contract']
  locations: string[];
  remote: boolean;
  min_salary?: number;
  max_commute?: number; // miles or km
}
```

---

## Naming Conventions

- **Collections**: lowercase with hyphens (kebab-case)
- **Fields**: lowercase with underscores (snake_case)
- **Document IDs**: auto-generated by Firestore unless specified (user-defaults uses user_id)
- **Timestamps**: Always use Firestore serverTimestamp() for consistency

---

## Best Practices

1. **Use Batch Writes**: For operations affecting multiple documents
2. **Use Transactions**: For operations requiring atomicity
3. **Paginate Queries**: Use `startAfter()` for large result sets
4. **Index Planning**: Create indexes before deploying queries
5. **Security First**: Always validate user permissions in security rules
6. **Timestamps**: Use server timestamps to avoid client clock issues
7. **Soft Deletes**: Consider adding `deleted_at` field instead of hard deletes for audit trails

---

## Migration Notes

This schema replaces the previous portfolio-based schema with job-finder-specific collections. Key changes:

- Added `job-queue` for asynchronous job processing
- Added `job-matches` for AI-analyzed job matches
- Split configuration into separate documents in `job-finder-config`
- Renamed `generator-documents` to `generation-history` for clarity
- Added `user-defaults` for user preferences
- Added more structured data types for job information

---

**Last Updated**: 2025-10-20
**Version**: 1.0.0
