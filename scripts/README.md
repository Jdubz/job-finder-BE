# Backend Scripts

Utility scripts for managing the job-finder-BE project.

## Seed Scripts

Seed scripts populate Firestore with initial data required for the application to function correctly.

### Personal Info Seed

Seeds the `generator-documents/personal-info` document with default personal information. This document is required for the generator settings page to load correctly.

**Usage:**

```bash
# Local emulator (default database)
FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/seed-personal-info.ts

# Staging environment (portfolio-staging database)
GOOGLE_CLOUD_PROJECT=static-sites-257923 DATABASE_ID=portfolio-staging npx tsx scripts/seed-personal-info.ts

# Production environment (portfolio database)
GOOGLE_CLOUD_PROJECT=static-sites-257923 DATABASE_ID=portfolio npx tsx scripts/seed-personal-info.ts
```

### AI Prompts Seed

Seeds the `job-finder-config/ai-prompts` document with default AI prompt templates for document generation and job matching.

**Usage:**

```bash
# Local emulator
FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/seed-ai-prompts.ts

# Staging
GOOGLE_CLOUD_PROJECT=static-sites-257923 npx tsx scripts/seed-ai-prompts.ts
```

## Development Setup

When setting up a new development environment with Firestore emulators:

1. **Start the Firebase emulators:**
   ```bash
   firebase emulators:start
   ```

2. **Seed required data:**
   ```bash
   # Seed personal info (required for settings page)
   FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/seed-personal-info.ts

   # Seed AI prompts (required for generator and job matching)
   FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/seed-ai-prompts.ts
   ```

3. **Verify data:**
   ```bash
   # Check personal info endpoint
   curl http://localhost:5001/static-sites-257923/us-central1/manageGenerator/generator/defaults
   ```

## Troubleshooting

### Settings Page Shows 404 Error

If the frontend settings page shows a 404 error when trying to load personal info:

1. **Check if personal-info document exists:**
   - Open Firestore Emulator UI: http://localhost:4000/firestore
   - Navigate to `generator-documents` collection
   - Verify `personal-info` document exists

2. **Seed the data:**
   ```bash
   FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/seed-personal-info.ts
   ```

3. **Test the endpoint:**
   ```bash
   curl http://localhost:5001/static-sites-257923/us-central1/manageGenerator/generator/defaults
   ```

   Should return 200 OK with personal info data.

### Empty Firestore After Emulator Restart

The Firestore emulator doesn't persist data by default. To maintain data across restarts, configure persistence in `firebase.json` or re-run seed scripts after each restart.
