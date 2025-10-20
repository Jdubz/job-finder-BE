# GitHub Secrets Setup Guide

This guide explains how to configure the required GitHub secrets for the CI/CD pipeline.

## Required Secrets

The CI/CD pipeline requires five secrets to be configured in your GitHub repository:

1. **FIREBASE_SERVICE_ACCOUNT** - Firebase service account JSON (shared across staging and production)
2. **FIREBASE_TOKEN_STAGING** - Firebase authentication token for staging
3. **FIREBASE_TOKEN_PRODUCTION** - Firebase authentication token for production
4. **FIREBASE_PROJECT_STAGING** - Firebase project ID for staging (e.g., `job-finder-staging`)
5. **FIREBASE_PROJECT_PRODUCTION** - Firebase project ID for production (e.g., `job-finder-production`)

## How to Add Secrets to GitHub

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter the secret name and value
5. Click **Add secret**

## Obtaining Firebase Service Account Key

### Method 1: Using GCP Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your Firebase project (works with both staging and production)
3. Navigate to **IAM & Admin** → **Service Accounts**
4. Find or create a service account with the following roles:
   - Firebase Admin
   - Cloud Functions Developer
   - Service Account User
5. Click on the service account
6. Go to **Keys** tab
7. Click **Add Key** → **Create new key**
8. Select **JSON** format
9. Download the key file
10. Copy the entire JSON content
11. Paste it as the value for **FIREBASE_SERVICE_ACCOUNT** in GitHub secrets

**Note**: This service account is shared across both staging and production environments.

### Method 2: Using gcloud CLI

```bash
# Create a service account key
gcloud iam service-accounts keys create firebase-key.json \
  --iam-account=firebase-deployer@YOUR-PROJECT.iam.gserviceaccount.com
```

Then copy the contents of this JSON file to GitHub secrets as **FIREBASE_SERVICE_ACCOUNT**.

## Obtaining Firebase Tokens

### Method 1: Using Firebase CLI (Recommended)

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login and generate token
firebase login:ci
```

This will open a browser for authentication. After successful login, it will output a token. Copy this token and save it as both **FIREBASE_TOKEN_STAGING** and **FIREBASE_TOKEN_PRODUCTION**.

**Note**: If you need separate tokens for staging and production, you may need to:
1. Logout: `firebase logout`
2. Login with the account that has access to staging
3. Generate token and save as FIREBASE_TOKEN_STAGING
4. Repeat for production account

### Method 2: Using Service Account (Alternative)

If you're using service accounts for authentication, you may not need separate Firebase tokens. In that case, you can use a placeholder value or the same value for both secrets, as the service account credentials will be used for authentication.

## Setting Firebase Project IDs

The project IDs should match your actual Firebase project names:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your staging project
3. Click the gear icon → Project settings
4. Copy the **Project ID** (not the project name)
5. Add this as **FIREBASE_PROJECT_STAGING** in GitHub secrets

Repeat for your production project and add as **FIREBASE_PROJECT_PRODUCTION**.

**Example values:**
- FIREBASE_PROJECT_STAGING: `job-finder-staging-abc123`
- FIREBASE_PROJECT_PRODUCTION: `job-finder-production-xyz789`

## Verifying Secrets

After adding all secrets, verify they are set correctly:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. You should see five secrets listed:
   - FIREBASE_SERVICE_ACCOUNT
   - FIREBASE_TOKEN_STAGING
   - FIREBASE_TOKEN_PRODUCTION
   - FIREBASE_PROJECT_STAGING
   - FIREBASE_PROJECT_PRODUCTION

## Testing the Setup

### Test CI Workflow
1. Create a test branch
2. Make a small change (e.g., update README.md)
3. Push the branch
4. Check GitHub Actions tab to see if CI workflow runs successfully

### Test Staging Deployment
1. Merge a change to the staging branch
2. Check GitHub Actions tab
3. Verify "Deploy to Staging" workflow runs
4. Check Firebase console to confirm deployment

### Test Production Deployment (Manual)
1. Go to GitHub Actions tab
2. Select "Deploy to Production" workflow
3. Click "Run workflow"
4. Select the main branch
5. Click "Run workflow" button
6. Monitor the deployment
7. Check Firebase console to confirm deployment

## Troubleshooting

### Error: "Invalid credentials"
- Verify the JSON format of your service account key is correct
- Ensure the service account has the required permissions
- Check that you're using the correct project ID

### Error: "Firebase token expired"
- Generate a new Firebase token using `firebase login:ci`
- Update the secret in GitHub

### Error: "Permission denied"
- Verify the service account has the following roles:
  - Firebase Admin
  - Cloud Functions Developer
  - Cloud Functions Admin
  - Service Account User

### Error: "Project not found"
- Verify the project ID in your firebase.json and .firebaserc
- Ensure the service account belongs to the correct project

## Security Best Practices

1. **Never commit secrets to your repository**
2. **Use different service accounts for staging and production**
3. **Regularly rotate service account keys** (recommended: every 90 days)
4. **Limit service account permissions** to only what's needed
5. **Use GitHub environment protection rules** for production deployments
6. **Monitor service account usage** in GCP Console
7. **Revoke old keys** after rotating to new ones

## Environment Protection (Optional but Recommended)

For additional security on production deployments:

1. Go to **Settings** → **Environments**
2. Click **New environment**
3. Name it "production"
4. Configure protection rules:
   - **Required reviewers**: Add team members who must approve
   - **Wait timer**: Add delay before deployment
   - **Deployment branches**: Limit to main branch only
5. Save rules

The production deployment workflow is already configured to use this environment.

## Additional Resources

- [GitHub Actions Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Firebase CLI Documentation](https://firebase.google.com/docs/cli)
- [GCP Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
- [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
