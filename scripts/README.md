# Deployment Scripts

This directory contains scripts for deploying and testing the Job Finder Backend.

## Scripts

### deploy-staging.sh

Automated deployment script for staging environment.

**Usage:**
```bash
./scripts/deploy-staging.sh
```

**What it does:**
1. Runs pre-deployment checks (lint, test, build)
2. Switches to staging Firebase project
3. Deploys Cloud Functions
4. Deploys Firestore rules and indexes
5. Deploys Storage rules
6. Verifies deployment

**Requirements:**
- Firebase CLI installed and authenticated
- Access to staging Firebase project
- All tests passing locally

### smoke-tests.sh

Post-deployment smoke tests to verify critical functionality.

**Usage:**
```bash
# Set auth token (optional but recommended)
export STAGING_AUTH_TOKEN="your-token"

# Run tests
./scripts/smoke-tests.sh
```

**What it tests:**
1. Cloud Functions accessibility
2. Health check endpoint (if exists)
3. Job queue management (with auth)
4. CORS configuration
5. Rate limiting setup

**Environment Variables:**
- `STAGING_URL` - Base URL for staging functions (default: https://us-central1-job-finder-staging.cloudfunctions.net)
- `STAGING_AUTH_TOKEN` - Firebase auth token for authenticated tests

**Exit codes:**
- `0` - All tests passed
- `1` - One or more tests failed

## Development

### Testing Scripts

Test script syntax without execution:
```bash
bash -n scripts/deploy-staging.sh
bash -n scripts/smoke-tests.sh
```

### Making Scripts Executable

```bash
chmod +x scripts/deploy-staging.sh
chmod +x scripts/smoke-tests.sh
```

## Documentation

For detailed deployment instructions, see:
- [Deployment Guide](../docs/DEPLOYMENT.md)
- [Monitoring Guide](../docs/MONITORING.md)
