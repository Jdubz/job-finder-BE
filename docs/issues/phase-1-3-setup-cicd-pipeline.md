# PHASE-1-3 — Set Up CI/CD Pipeline

> **Context**: See [README.md](../../README.md) for project overview and deployment strategy
> **Architecture**: GitHub Actions for automated testing, linting, and deployment to Firebase

---

## Issue Metadata

```yaml
Title: PHASE-1-3 — Set Up CI/CD Pipeline
Labels: priority-p1, repository-backend, type-devops, status-todo, phase-1
Assignee: Worker A
Priority: P1-High
Estimated Effort: 4-6 hours
Repository: job-finder-BE
```

---

## Summary

**Problem**: The job-finder-BE repository needs automated CI/CD to ensure code quality, run tests, and deploy to staging/production environments without manual intervention.

**Goal**: Implement GitHub Actions workflows for continuous integration (linting, testing) and continuous deployment (automated staging deployments, manual production deployments with approvals).

**Impact**: Reduces deployment errors, enforces code quality standards, and enables rapid iteration with confidence. Ensures all code is tested before reaching production.

---

## Architecture References

> **📚 Read these docs first for context:**

- **[README.md](../../README.md)** - Deployment commands and environment configuration
- **[BACKEND_MIGRATION_PLAN.md](../../../docs/architecture/BACKEND_MIGRATION_PLAN.md)** - Deployment strategy (Phase 6)
- **GitHub Actions**: https://docs.github.com/en/actions

**Key concepts to understand**:
- CI/CD Pipeline: Automated testing and deployment on git events
- Environment Separation: Staging for testing, production for users
- Secret Management: GitHub secrets for Firebase credentials

---

## Tasks

### Phase 1: Set Up CI Workflow
1. **Create CI workflow file**
   - What: Create GitHub Actions workflow for pull requests
   - Where: `.github/workflows/ci.yml`
   - Why: Runs tests and linting on every PR to catch issues early
   - Test: Workflow runs on PR creation, passes/fails correctly

2. **Configure test job**
   - What: Set up job to install dependencies, build, lint, and test
   - Where: `.github/workflows/ci.yml` - `test` job
   - Why: Validates code quality before merging
   - Test: Job runs successfully on sample PR

3. **Add branch protection rules**
   - What: Require CI to pass before merging to staging/main
   - Where: GitHub repository settings
   - Why: Prevents broken code from being merged
   - Test: Cannot merge PR with failing CI

### Phase 2: Set Up Staging Deployment
4. **Create staging deployment workflow**
   - What: Auto-deploy to staging on merge to `staging` branch
   - Where: `.github/workflows/deploy-staging.yml`
   - Why: Automatically updates staging environment for testing
   - Test: Merge to staging triggers deployment

5. **Configure Firebase staging credentials**
   - What: Add Firebase service account and project ID as GitHub secrets
   - Where: GitHub repository secrets (FIREBASE_SERVICE_ACCOUNT_STAGING, FIREBASE_PROJECT_STAGING)
   - Why: Enables GitHub Actions to deploy to Firebase
   - Test: Deployment workflow authenticates successfully

### Phase 3: Set Up Production Deployment
6. **Create production deployment workflow**
   - What: Manual deployment to production with approval
   - Where: `.github/workflows/deploy-production.yml`
   - Why: Controlled production deployments with human oversight
   - Test: Manual workflow trigger deploys to production

7. **Configure Firebase production credentials**
   - What: Add production Firebase credentials as GitHub secrets
   - Where: GitHub repository secrets (FIREBASE_SERVICE_ACCOUNT_PRODUCTION, FIREBASE_PROJECT_PRODUCTION)
   - Why: Separate credentials for production security
   - Test: Production deployment authenticates and deploys

### Phase 4: Add Deployment Notifications
8. **Add status notifications**
   - What: Configure workflow to notify on success/failure (Slack, email, or GitHub)
   - Where: Workflow steps with notification actions
   - Why: Team knows immediately when deployments succeed or fail
   - Test: Notifications sent on deployment completion

---

## Technical Details

### Files to Create

```
CREATE:
- .github/workflows/ci.yml - Continuous integration workflow
- .github/workflows/deploy-staging.yml - Staging deployment workflow
- .github/workflows/deploy-production.yml - Production deployment workflow
- .github/workflows/test.yml (optional) - Separate test workflow

CONFIGURE:
- GitHub Repository Secrets:
  - FIREBASE_SERVICE_ACCOUNT_STAGING
  - FIREBASE_PROJECT_STAGING
  - FIREBASE_SERVICE_ACCOUNT_PRODUCTION
  - FIREBASE_PROJECT_PRODUCTION
```

### Key Implementation Notes

**CI Workflow**:
```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [staging, main]
  push:
    branches: [staging, main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Build TypeScript
        run: npm run build

      - name: Run tests
        run: npm test
```

**Staging Deployment Workflow**:
```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging

on:
  push:
    branches: [staging]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to Firebase Staging
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT_STAGING }}'
          projectId: '${{ secrets.FIREBASE_PROJECT_STAGING }}'
          channelId: live
```

**Production Deployment Workflow**:
```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  workflow_dispatch:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://your-production-url.com

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to Firebase Production
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT_PRODUCTION }}'
          projectId: '${{ secrets.FIREBASE_PROJECT_PRODUCTION }}'
          channelId: live
```

**Integration Points**:
- GitHub Actions: Triggers on push/PR events
- Firebase CLI: Deploys functions to Firebase
- GitHub Secrets: Stores sensitive credentials securely

---

## Acceptance Criteria

- [ ] **CI workflow created**: `.github/workflows/ci.yml` runs on PRs
- [ ] **Tests run in CI**: Linting, building, and testing execute automatically
- [ ] **Staging deployment**: Auto-deploys on merge to `staging` branch
- [ ] **Production deployment**: Manual trigger or auto-deploy on merge to `main`
- [ ] **Secrets configured**: Firebase credentials stored in GitHub secrets
- [ ] **Branch protection**: Cannot merge without CI passing
- [ ] **Notifications work**: Team notified of deployment success/failure
- [ ] **All workflows tested**: Each workflow has been triggered and works correctly

---

## Testing

### Test Commands

```bash
# Test locally before pushing
npm run lint
npm run build
npm test

# Test Firebase deployment locally
firebase deploy --only functions --dry-run
```

### Manual Testing

```bash
# Step 1: Create test PR
# Create a feature branch and open PR to staging
# Verify CI workflow runs

# Step 2: Merge to staging
# Merge PR to staging branch
# Verify staging deployment workflow runs
# Check Firebase console for deployed functions

# Step 3: Test production deployment
# Create PR from staging to main
# Merge to main
# Verify production deployment workflow runs
# Check production Firebase console

# Step 4: Test manual production deployment
# Go to GitHub Actions → Deploy to Production → Run workflow
# Verify it triggers and deploys successfully
```

---

## Commit Message Template

```
feat(ci-cd): set up GitHub Actions CI/CD pipeline

Implement complete CI/CD pipeline with GitHub Actions for automated testing,
linting, and deployment to staging/production Firebase environments. Includes
branch protection, environment separation, and deployment notifications.

Key changes:
- Create CI workflow for pull request validation (lint, build, test)
- Create staging deployment workflow (auto-deploy on merge to staging)
- Create production deployment workflow (manual trigger or auto-deploy to main)
- Configure Firebase credentials as GitHub secrets
- Set up branch protection requiring CI to pass
- Add deployment status notifications

Testing:
- CI workflow runs on test PR and passes
- Staging deployment triggers on merge to staging
- Production deployment works with manual trigger
- All workflows authenticate and deploy successfully

Closes #3
```

---

## Related Issues

- **Depends on**: #1 (Initialize project structure), #2 (Shared infrastructure)
- **Blocks**: #11 (Deploy to staging), #12 (Deploy to production)
- **Related**: BACKEND_MIGRATION_PLAN.md Phase 1, Task 5

---

## Resources

### Documentation
- **GitHub Actions**: https://docs.github.com/en/actions
- **Firebase GitHub Action**: https://github.com/marketplace/actions/deploy-to-firebase-hosting
- **Firebase CLI**: https://firebase.google.com/docs/cli

### External References
- **Workflow Syntax**: https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions
- **Environment Secrets**: https://docs.github.com/en/actions/security-guides/encrypted-secrets

---

## Success Metrics

**How we'll measure success**:
- CI workflow execution time: < 5 minutes
- Deployment workflow time: < 10 minutes
- Zero manual intervention needed for staging deployments
- 100% of PRs tested before merge
- All deployments logged and notified

---

## Notes

**Questions? Need clarification?**
- Comment on this issue with specific questions
- Tag @PM for guidance
- Reference GitHub Actions documentation

**Implementation Tips**:
- Test workflows on a feature branch first before pushing to staging
- Use `workflow_dispatch` for manual trigger testing
- Store all sensitive data in GitHub secrets, never in code
- Consider adding deployment previews for PRs
- Set up Slack/Discord webhook for deployment notifications
- Use environment protection rules for production (require approval)

**Getting Firebase Service Account**:
```bash
# Generate service account key
firebase login:ci

# Or create service account in GCP Console:
# IAM & Admin → Service Accounts → Create Key (JSON)
# Store JSON contents in GitHub secret
```

---

**Created**: 2025-10-20
**Created By**: PM
**Last Updated**: 2025-10-20
**Status**: Todo
