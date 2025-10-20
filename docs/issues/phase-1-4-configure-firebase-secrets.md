# PHASE-1-4 — Configure Firebase Project and Secrets

> **Context**: See [README.md](../../README.md) for project overview and environment configuration
> **Architecture**: Firebase project setup, Google Cloud Secret Manager, environment variables

---

## Issue Metadata

```yaml
Title: PHASE-1-4 — Configure Firebase Project and Secrets
Labels: priority-p1, repository-backend, type-configuration, status-todo, phase-1
Assignee: Worker A
Priority: P1-High
Estimated Effort: 3-5 hours
Repository: job-finder-BE
```

---

## Summary

**Problem**: The job-finder-BE backend needs Firebase project configuration, Google Cloud Secret Manager setup, and environment variables to access APIs (OpenAI, Claude), authenticate with Firebase, and communicate with other services.

**Goal**: Set up Firebase projects (staging and production), configure Secret Manager with all required API keys and credentials, and document environment variables for local development.

**Impact**: Enables backend functions to securely access external APIs, authenticate users, and operate in multiple environments (local, staging, production) without hardcoding credentials.

---

## Architecture References

> **📚 Read these docs first for context:**

- **[README.md](../../README.md)** - Environment variables and security documentation
- **[BACKEND_MIGRATION_PLAN.md](../../../docs/architecture/BACKEND_MIGRATION_PLAN.md)** - Phase 1, Task 6: Environment setup
- **Secret Manager**: https://cloud.google.com/secret-manager/docs

**Key concepts to understand**:
- Secret Manager: Secure storage for API keys and sensitive data
- Environment Separation: Different Firebase projects for staging/production
- Service Accounts: Programmatic access to Firebase and GCP services

---

## Tasks

### Phase 1: Firebase Project Setup
1. **Create or select Firebase projects**
   - What: Set up staging and production Firebase projects
   - Where: Firebase Console (console.firebase.google.com)
   - Why: Separate environments prevent production data contamination
   - Test: Both projects visible in Firebase console

2. **Configure project aliases**
   - What: Set up `.firebaserc` with staging and production aliases
   - Where: `.firebaserc`
   - Why: Enables `firebase use staging` and `firebase use production` commands
   - Test: `firebase use staging` switches correctly

3. **Enable required Firebase services**
   - What: Enable Authentication, Firestore, Cloud Functions, Storage in both projects
   - Where: Firebase Console for each project
   - Why: Backend APIs depend on these services
   - Test: All services show as enabled in console

### Phase 2: Google Cloud Secret Manager Setup
4. **Enable Secret Manager API**
   - What: Enable Secret Manager API in GCP console for both projects
   - Where: GCP Console → APIs & Services → Library
   - Why: Required to create and access secrets
   - Test: Secret Manager appears in GCP navigation

5. **Create required secrets**
   - What: Create secrets for OpenAI, Claude, and other API keys
   - Where: GCP Console → Secret Manager or `gcloud` CLI
   - Why: Secure storage of sensitive credentials
   - Test: All secrets listed in Secret Manager

6. **Grant service account access**
   - What: Grant Cloud Functions service account access to secrets
   - Where: IAM permissions for each secret
   - Why: Functions need permission to read secrets at runtime
   - Test: Service account has "Secret Manager Secret Accessor" role

### Phase 3: Environment Variables Configuration
7. **Create .env.local for development**
   - What: Create local environment file with all variables
   - Where: `.env.local` (gitignored)
   - Why: Local development without accessing production secrets
   - Test: Functions can read environment variables in emulator

8. **Update .env.example**
   - What: Document all required environment variables
   - Where: `.env.example` (committed to git)
   - Why: Developers know what configuration is needed
   - Test: .env.example lists all variables with descriptions

---

## Technical Details

### Secrets to Create

```
SECRET MANAGER SECRETS (both staging and production):
- openai-api-key - OpenAI API key for GPT models
- anthropic-api-key - Anthropic API key for Claude models
- google-ai-api-key (optional) - Google AI/Gemini API key
- firebase-admin-key (if needed) - Firebase Admin SDK key
- smtp-credentials (if email needed) - Email service credentials

ENVIRONMENT-SPECIFIC CONFIGURATION:
- Firebase project IDs
- Firestore collection names
- CORS allowed origins
- Rate limiting thresholds
- Log levels
```

### Key Implementation Notes

**.firebaserc**:
```json
{
  "projects": {
    "default": "job-finder-staging",
    "staging": "job-finder-staging",
    "production": "job-finder-production"
  }
}
```

**.env.local (example for development)**:
```env
# Firebase Configuration
FIREBASE_PROJECT_ID=job-finder-dev
GCP_PROJECT_ID=job-finder-dev

# API Keys (use test keys for local dev)
OPENAI_API_KEY=sk-test-your-test-key
ANTHROPIC_API_KEY=sk-ant-test-your-test-key

# Service Configuration
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5001
LOG_LEVEL=debug
NODE_ENV=development

# Firestore Emulator (if using)
FIRESTORE_EMULATOR_HOST=localhost:8080
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
```

**.env.example**:
```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
GCP_PROJECT_ID=your-gcp-project-id

# API Keys (stored in Secret Manager for staging/production)
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Service Configuration
CORS_ALLOWED_ORIGINS=https://your-frontend-url.com
LOG_LEVEL=info
NODE_ENV=production

# Optional: Email Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
```

**Creating Secrets via gcloud CLI**:
```bash
# Set project
gcloud config set project job-finder-staging

# Create OpenAI secret
echo "sk-your-openai-key" | gcloud secrets create openai-api-key --data-file=-

# Create Anthropic secret
echo "sk-ant-your-anthropic-key" | gcloud secrets create anthropic-api-key --data-file=-

# Grant service account access
gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:job-finder-staging@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**Accessing Secrets in Functions**:
```typescript
// src/services/secret-manager.service.ts
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

export class SecretManagerService {
  private client = new SecretManagerServiceClient();

  async getSecret(secretName: string): Promise<string> {
    const projectId = process.env.GCP_PROJECT_ID;
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

    const [version] = await this.client.accessSecretVersion({ name });
    return version.payload?.data?.toString() || '';
  }
}
```

---

## Acceptance Criteria

- [ ] **Firebase projects created**: Staging and production projects exist
- [ ] **Project aliases configured**: `.firebaserc` has staging and production aliases
- [ ] **Services enabled**: Auth, Firestore, Functions, Storage enabled in both projects
- [ ] **Secret Manager enabled**: API enabled in both GCP projects
- [ ] **Secrets created**: All required API keys stored in Secret Manager
- [ ] **Service account permissions**: Functions can access secrets
- [ ] **.env.local created**: Local development environment configured
- [ ] **.env.example updated**: All variables documented with descriptions

---

## Testing

### Test Commands

```bash
# Test Firebase project selection
firebase use staging
firebase projects:list

# Test secret access (requires gcloud CLI)
gcloud config set project job-finder-staging
gcloud secrets list
gcloud secrets versions access latest --secret="openai-api-key"

# Test local environment
cat .env.local
npm run serve
# Check if functions can read environment variables
```

### Manual Testing

```bash
# Step 1: Verify Firebase projects
firebase login
firebase projects:list
# Should show staging and production projects

# Step 2: Test project switching
firebase use staging
# Should output: "Now using project job-finder-staging"

firebase use production
# Should output: "Now using project job-finder-production"

# Step 3: Verify secrets in GCP
gcloud config set project job-finder-staging
gcloud secrets list
# Should show: openai-api-key, anthropic-api-key, etc.

# Step 4: Test secret access
gcloud secrets versions access latest --secret="openai-api-key"
# Should output the API key

# Step 5: Test local environment
npm run serve
# In another terminal, test an endpoint that uses secrets
curl http://localhost:5001/job-finder-staging/us-central1/healthCheck
```

---

## Commit Message Template

```
feat(config): configure Firebase projects and Secret Manager

Set up Firebase projects for staging and production with all required services.
Configure Google Cloud Secret Manager with API keys and credentials. Create
environment variable templates for local development and documentation.

Key changes:
- Create/configure Firebase staging and production projects
- Set up .firebaserc with project aliases
- Enable Auth, Firestore, Functions, Storage in both projects
- Enable Secret Manager API in GCP
- Create secrets for OpenAI, Anthropic, and other API keys
- Grant service account access to secrets
- Create .env.local for local development
- Update .env.example with all variable documentation

Testing:
- firebase use staging/production switches correctly
- All secrets accessible via gcloud CLI
- Service accounts have correct IAM permissions
- Local emulator can read environment variables

Closes #4
```

---

## Related Issues

- **Depends on**: #1 (Initialize project structure), #2 (Shared infrastructure)
- **Blocks**: #5 (Migrate job-queue functions), #8 (Migrate generator functions)
- **Related**: BACKEND_MIGRATION_PLAN.md Phase 1, Task 6

---

## Resources

### Documentation
- **Firebase Console**: https://console.firebase.google.com
- **GCP Console**: https://console.cloud.google.com
- **Secret Manager**: https://cloud.google.com/secret-manager/docs
- **Firebase CLI**: https://firebase.google.com/docs/cli

### External References
- **Service Accounts**: https://cloud.google.com/iam/docs/service-accounts
- **IAM Roles**: https://cloud.google.com/iam/docs/understanding-roles
- **gcloud CLI**: https://cloud.google.com/sdk/gcloud

---

## Success Metrics

**How we'll measure success**:
- All secrets accessible from Cloud Functions
- Zero hardcoded credentials in code
- Local development works without production secrets
- Staging and production environments completely isolated
- Service accounts have minimal required permissions (principle of least privilege)

---

## Notes

**Questions? Need clarification?**
- Comment on this issue with specific questions
- Tag @PM for guidance
- Never commit actual secrets to git (use .env.example only)

**Implementation Tips**:
- Use separate API keys for staging and production
- Set up billing alerts in GCP to monitor Secret Manager costs (minimal)
- Create secrets with descriptive names (e.g., `openai-api-key-staging`)
- Document which service account needs access to which secrets
- Test secret access in emulator before deploying
- Keep `.env.local` in `.gitignore` - never commit it
- Use `firebase functions:secrets:set` command for easier secret management

**Getting Service Account Email**:
```bash
# Find your Cloud Functions service account
gcloud iam service-accounts list

# Typical format:
# {project-id}@appspot.gserviceaccount.com
```

**Secret Manager Best Practices**:
- Use latest version for automatic updates
- Set up secret rotation for sensitive keys
- Audit secret access logs periodically
- Grant minimal IAM permissions (secretAccessor, not secretViewer)

---

**Created**: 2025-10-20
**Created By**: PM
**Last Updated**: 2025-10-20
**Status**: Todo
