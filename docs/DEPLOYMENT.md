# Deployment Guide

This guide provides step-by-step instructions for deploying the Job Finder Backend to staging and production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Deploying to Staging](#deploying-to-staging)
- [Deploying to Production](#deploying-to-production)
- [Post-Deployment Validation](#post-deployment-validation)
- [Monitoring and Logging](#monitoring-and-logging)
- [Rollback Procedures](#rollback-procedures)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying, ensure you have:

1. **Firebase CLI installed and authenticated**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Access to Firebase projects**
   - Staging: `job-finder-staging`
   - Production: `job-finder-production`

3. **Required permissions**
   - Firebase Admin or Editor role
   - Cloud Functions Developer role
   - Secret Manager Admin role (for secrets access)

4. **Local development environment**
   - Node.js 20+
   - npm or yarn
   - Git

## Environment Configuration

### Firebase Projects

The repository is configured with two Firebase projects:

```json
{
  "projects": {
    "staging": "job-finder-staging",
    "production": "job-finder-production",
    "default": "job-finder-production"
  }
}
```

### Environment Variables

Set up the following environment variables for smoke tests:

```bash
# For staging smoke tests
export STAGING_URL="https://us-central1-job-finder-staging.cloudfunctions.net"
export STAGING_AUTH_TOKEN="your-staging-token"

# For production smoke tests
export PRODUCTION_URL="https://us-central1-job-finder-production.cloudfunctions.net"
export PRODUCTION_AUTH_TOKEN="your-production-token"
```

### Secrets Configuration

Ensure all required secrets are configured in Google Cloud Secret Manager for each environment:

Required secrets:
- `OPENAI_API_KEY` - OpenAI API key for document generation
- `FIREBASE_ADMIN_SDK_KEY` - Firebase Admin SDK credentials
- Any other application-specific secrets

To add secrets:
```bash
echo -n "your-secret-value" | gcloud secrets create SECRET_NAME --data-file=-
```

Grant Cloud Functions access:
```bash
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:YOUR-PROJECT@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Deploying to Staging

### Automated Deployment

Use the deployment script for a complete, automated deployment:

```bash
./scripts/deploy-staging.sh
```

This script will:
1. ✓ Run linter
2. ✓ Run all tests
3. ✓ Build production bundle
4. ✓ Switch to staging project
5. ✓ Deploy Cloud Functions
6. ✓ Deploy Firestore rules and indexes
7. ✓ Deploy Storage rules
8. ✓ Verify deployment

### Manual Deployment

If you prefer manual control, follow these steps:

#### Step 1: Pre-deployment Checks

```bash
# Run linter
npm run lint

# Run tests
npm test

# Build production bundle
npm run build
```

#### Step 2: Switch to Staging

```bash
firebase use staging
```

#### Step 3: Deploy Functions

```bash
# Deploy all functions
firebase deploy --only functions --force

# Or deploy specific function
firebase deploy --only functions:manageJobQueue
```

#### Step 4: Deploy Firestore Configuration

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

#### Step 5: Deploy Storage Rules

```bash
firebase deploy --only storage
```

#### Step 6: Verify Deployment

```bash
# List deployed functions
firebase functions:list

# Check function URLs
firebase functions:list | grep https://
```

### Deployment Options

**Deploy everything at once:**
```bash
firebase deploy
```

**Deploy only functions:**
```bash
firebase deploy --only functions
```

**Deploy with force flag (bypass confirmation):**
```bash
firebase deploy --only functions --force
```

**Deploy specific function:**
```bash
firebase deploy --only functions:functionName
```

## Deploying to Production

Production deployment follows the same process as staging but targets the production project.

### Important: Production Checklist

Before deploying to production:

- [ ] All staging tests have passed
- [ ] Frontend staging integration is validated
- [ ] Performance metrics are acceptable
- [ ] No critical bugs in staging
- [ ] Team has approved deployment
- [ ] Rollback plan is ready
- [ ] Monitoring is configured

### Production Deployment

```bash
# Switch to production
firebase use production

# Deploy (use the same commands as staging)
firebase deploy --only functions --force
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only storage
```

Or use a production deployment script:
```bash
./scripts/deploy-production.sh  # If you create one
```

## Post-Deployment Validation

### Smoke Tests

Run smoke tests to verify critical functionality:

```bash
# Set auth token
export STAGING_AUTH_TOKEN="your-token"

# Run tests
./scripts/smoke-tests.sh
```

### Manual Testing

1. **Test function invocation**
   ```bash
   curl -X POST https://us-central1-job-finder-staging.cloudfunctions.net/manageJobQueue \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"data":{"action":"getStats"}}'
   ```

2. **Check Firestore**
   - Open Firebase Console → Firestore
   - Verify security rules are active
   - Test read/write operations

3. **Check Storage**
   - Open Firebase Console → Storage
   - Verify security rules are active
   - Test file upload/download

4. **Test frontend integration**
   - Open staging frontend: https://job-finder-staging.web.app
   - Submit a test job
   - Verify end-to-end workflow

### Verify Logs

```bash
# View all function logs
firebase functions:log

# View specific function logs
firebase functions:log --only manageJobQueue

# Follow logs in real-time
firebase functions:log --only manageJobQueue --follow
```

## Monitoring and Logging

### Firebase Console

Monitor functions in Firebase Console:
1. Go to https://console.firebase.google.com/
2. Select your project
3. Navigate to Functions → Logs

### Key Metrics to Monitor

Monitor these metrics for 1 hour after deployment:

- **Execution count**: Number of function invocations
- **Execution time**: p50, p95, p99 latencies
- **Error rate**: Percentage of failed executions
- **Memory usage**: Peak memory consumption
- **Cold start frequency**: Number of cold starts
- **Firestore operations**: Read/write counts
- **Secret Manager calls**: Secret access frequency

### Cloud Monitoring

Set up dashboards and alerts in Google Cloud Console:

1. Go to https://console.cloud.google.com/
2. Select your project
3. Navigate to Monitoring → Dashboards

Create alerts for:
- Error rate > 5% for 5 minutes
- Execution time p95 > 10 seconds
- Function crashes > 10 per hour
- Firestore quota exceeded

### Log Queries

Useful log queries in Cloud Logging:

```
# All function errors
resource.type="cloud_function"
severity="ERROR"

# Specific function logs
resource.type="cloud_function"
resource.labels.function_name="manageJobQueue"

# Slow executions (>5 seconds)
resource.type="cloud_function"
jsonPayload.executionTimeMs>5000

# Authentication failures
resource.type="cloud_function"
textPayload:"unauthorized"
```

## Rollback Procedures

If issues are discovered after deployment, rollback to the previous version.

### Rollback via Firebase Console

1. Go to Firebase Console → Functions
2. Select the problematic function
3. Click on "Versions" tab
4. Find the previous working version
5. Click "Rollback" button

### Rollback via CLI

```bash
# Rollback to previous deployment
firebase deploy --only functions:functionName --force

# This will deploy the current code, so make sure to:
# 1. Git revert to previous commit, OR
# 2. Use Firebase Console rollback instead
```

### Git-based Rollback

```bash
# Find the last working commit
git log --oneline

# Create a revert commit
git revert <commit-hash>

# Deploy the reverted version
npm run build
firebase deploy --only functions --force
```

## Troubleshooting

### Common Issues

#### Functions not deploying

**Problem**: Deployment fails with permission errors

**Solution**:
```bash
# Check you have the right permissions
gcloud projects get-iam-policy YOUR-PROJECT-ID

# Ensure you're using the right project
firebase use
```

#### Function timeouts

**Problem**: Functions timing out after deployment

**Solution**:
- Check function memory allocation in `firebase.json`
- Review function timeout settings (max 9 minutes for 2nd gen)
- Optimize slow operations

#### Missing secrets

**Problem**: Functions fail with "Secret not found" errors

**Solution**:
```bash
# List all secrets
gcloud secrets list

# Check secret access
gcloud secrets describe SECRET_NAME

# Grant access if needed
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:YOUR-PROJECT@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

#### CORS errors

**Problem**: Frontend cannot call functions due to CORS

**Solution**:
- Verify allowed origins in function CORS configuration
- Check CORS middleware is applied
- Test CORS with curl:
  ```bash
  curl -I -X OPTIONS https://your-function-url \
    -H "Origin: https://your-frontend-domain" \
    -H "Access-Control-Request-Method: POST"
  ```

#### Firestore permission errors

**Problem**: Users getting permission denied errors

**Solution**:
- Verify Firestore rules are deployed
- Test rules in Firebase Console → Firestore → Rules → Playground
- Check user authentication status

#### Build failures

**Problem**: `npm run build` fails

**Solution**:
```bash
# Clean build artifacts
npm run clean

# Reinstall dependencies
rm -rf node_modules functions/node_modules
rm package-lock.json functions/package-lock.json
npm install
cd functions && npm install && cd ..

# Try build again
npm run build
```

#### Cold start issues

**Problem**: Functions have slow cold starts (>3 seconds)

**Solution**:
- Consider setting minimum instances for critical functions
- Optimize function initialization code
- Use Cloud Run for CPU-intensive tasks

### Getting Help

If you encounter issues not covered here:

1. Check Firebase Function logs
2. Review Cloud Logging for detailed errors
3. Search Firebase documentation
4. Contact the development team
5. Create an issue in the repository

### Support Resources

- **Firebase Documentation**: https://firebase.google.com/docs/functions
- **Cloud Functions Docs**: https://cloud.google.com/functions/docs
- **Firebase Support**: https://firebase.google.com/support
- **Stack Overflow**: Tag questions with `firebase-functions`

## Best Practices

### Deployment Schedule

- Deploy staging during business hours
- Deploy production during off-peak hours (if possible)
- Never deploy on Fridays or before holidays
- Have the team available for 1 hour post-deployment

### Pre-deployment

- Always run tests locally first
- Review recent code changes
- Check for breaking changes
- Update documentation
- Notify team of deployment

### Post-deployment

- Monitor logs for 1 hour
- Test critical user workflows
- Check error rates and metrics
- Verify frontend integration
- Document any issues

### Security

- Never commit secrets to repository
- Use Secret Manager for sensitive data
- Review security rules before deployment
- Test authentication and authorization
- Keep dependencies up to date

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-10-20 | Initial deployment guide |

---

For questions or issues, contact the development team or create an issue in the repository.
