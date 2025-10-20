# Job Finder Backend API

Firebase Cloud Functions backend for the Job Finder Application.

## Overview

This repository contains the backend API implementation for the Job Finder application, providing:

- **Job Queue Management**: API endpoints for submitting and managing job search tasks
- **Job Matches**: Storage and retrieval of job matches
- **Configuration**: System configuration management
- **Authentication**: User authentication and authorization
- **Rate Limiting**: Request rate limiting and security

## Architecture

### Technology Stack

- **Runtime**: Node.js 20
- **Framework**: Firebase Cloud Functions (2nd gen)
- **Language**: TypeScript
- **Database**: Cloud Firestore
- **Authentication**: Firebase Authentication
- **Secrets**: Google Cloud Secret Manager
- **Testing**: Jest + Firebase Functions Test

### Project Structure

```
job-finder-BE/
├── src/
│   ├── config/           # Configuration management
│   ├── middleware/       # Express middleware (CORS, rate limiting, validation)
│   ├── services/         # Business logic services
│   │   ├── firestore.service.ts
│   │   └── secret-manager.service.ts
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   ├── __tests__/       # Test files
│   └── index.ts         # Cloud Functions entry point
├── dist/                # Compiled JavaScript (generated)
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── firebase.json        # Firebase configuration
└── jest.config.js       # Jest test configuration
```

## Setup

### Prerequisites

- Node.js 20+
- npm or yarn
- Firebase CLI: `npm install -g firebase-tools`
- Access to Firebase project

### Installation

1. Clone the repository (or use the worktree):
   ```bash
   cd /home/jdubz/Development/job-finder-app-manager/worktrees/worker-a-job-finder-BE
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. Login to Firebase:
   ```bash
   firebase login
   ```

5. Select your Firebase project:
   ```bash
   firebase use --add
   ```

## Development

### Local Development

Start the Firebase emulator:
```bash
npm start
```

The functions will be available at:
- `http://localhost:5001/<project-id>/<region>/<function-name>`

### Build

Compile TypeScript to JavaScript:
```bash
npm run build
```

### Testing

This project uses Jest for comprehensive testing with unit, integration, and end-to-end tests.

#### Test Structure

```
src/__tests__/
├── helpers/           # Test utilities and mocks
│   └── test-utils.ts
├── services/          # Unit tests for service classes
│   ├── firestore.service.test.ts
│   └── job-queue.service.test.ts
├── integration/       # Integration tests (require emulators)
│   └── firestore.test.ts
├── e2e/              # End-to-end tests (require emulators)
│   └── job-submission.test.ts
└── setup.ts          # Test environment configuration
```

#### Running Tests

Run all tests:
```bash
npm test
```

Run unit tests only (no emulators required):
```bash
npm run test:unit
```

Run integration tests (requires Firestore emulator):
```bash
firebase emulators:exec --only firestore "npm run test:integration"
```

Run E2E tests (requires all emulators):
```bash
firebase emulators:exec "npm run test:e2e"
```

Run tests in watch mode (for development):
```bash
npm run test:watch
```

Generate coverage report:
```bash
npm run test:coverage
```

Run tests in CI mode:
```bash
npm run test:ci
```

#### Coverage Requirements

The project maintains the following coverage thresholds:
- **Statements**: 80%
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%

View the coverage report after running `npm run test:coverage`:
```bash
open coverage/lcov-report/index.html
```

#### Writing Tests

**Unit Tests**: Test individual functions and services in isolation with mocked dependencies.
```typescript
import { JobQueueService } from '../../services/job-queue.service';
import { createMockLogger } from '../helpers/test-utils';

describe('JobQueueService', () => {
  it('should submit a job successfully', async () => {
    const service = new JobQueueService(createMockLogger());
    // Test implementation
  });
});
```

**Integration Tests**: Test interactions with external services using emulators.
```typescript
// Requires Firebase emulators to be running
describe('Firestore Integration', () => {
  it('should create and retrieve documents', async () => {
    // Test with real Firestore emulator
  });
});
```

**E2E Tests**: Test complete user workflows end-to-end.
```typescript
// Tests full workflow from API to database
describe('Job Submission E2E', () => {
  it('should submit and retrieve job status', async () => {
    // Test complete workflow
  });
});
```

### Linting

Check code quality:
```bash
npm run lint
```

Auto-fix issues:
```bash
npm run lint:fix
```

## Deployment

### Deploy to Staging

```bash
npm run deploy:staging
```

### Deploy to Production

```bash
npm run deploy
```

## API Endpoints

### Health Check

```
GET /health
```

Returns service health status.

### Job Queue (Coming Soon)

- `POST /submitJob` - Submit a new job search task
- `POST /submitScrape` - Submit a scraping task
- `POST /submitCompany` - Submit a company search task
- `GET /queue` - Get queue status
- `GET /queue/stats` - Get queue statistics

### Job Matches (Coming Soon)

- `GET /matches` - Get user's job matches
- `PUT /matches/:id` - Update a job match

### Configuration (Coming Soon)

- `GET /config` - Get system configuration
- `PUT /config` - Update system configuration

## Environment Variables

See `.env.example` for all available environment variables.

Key variables:
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `GCP_PROJECT_ID` - Google Cloud project ID
- `CORS_ALLOWED_ORIGINS` - Allowed CORS origins
- `LOG_LEVEL` - Logging level (debug, info, warn, error)

## Security

### Secrets Management

Secrets are stored in Google Cloud Secret Manager:
1. Create secrets in GCP Console or using `gcloud` CLI
2. Grant Cloud Functions service account access to secrets
3. Reference secrets in function configuration

### CORS

CORS is configured to only allow requests from whitelisted origins.
Update `CORS_ALLOWED_ORIGINS` in environment variables.

### Rate Limiting

Rate limiting is applied to all endpoints to prevent abuse.
Default: 100 requests per 15 minutes per IP.

### Authentication

Functions requiring authentication validate Firebase ID tokens.
Include token in Authorization header: `Bearer <token>`

## Monitoring

### Logs

View function logs:
```bash
npm run logs
```

Or in Firebase Console:
- https://console.firebase.google.com/project/<project-id>/functions/logs

### Metrics

Monitor function performance in:
- Firebase Console > Functions
- Google Cloud Console > Cloud Functions

## CI/CD

GitHub Actions workflow automatically:
1. Runs tests on pull requests
2. Deploys to staging on merge to `staging` branch
3. Deploys to production on merge to `main` branch

## Contributing

### Workflow

1. Work in your dedicated worktree: `worktrees/worker-a-job-finder-BE`
2. Work on your branch: `worker-a-job-finder-BE`
3. Sync with staging: `git pull origin staging`
4. Make changes and commit
5. Push to your branch
6. Create PR to `staging` branch
7. After PR approval, PM merges to staging

### Code Standards

- Follow TypeScript/ESLint rules
- Write tests for new features
- Document all functions
- Use meaningful commit messages
- Reference issue numbers in commits

## Troubleshooting

### Common Issues

**Functions not deploying:**
- Check Firebase project is selected: `firebase use`
- Verify you have deployment permissions
- Check build succeeds: `npm run build`

**Emulator not starting:**
- Check port 5001 is available
- Verify Firebase tools installed: `firebase --version`
- Check logs for errors

**Type errors:**
- Run `npm install` to ensure all types are installed
- Check `tsconfig.json` settings

## Migration Notes

This repository was created by migrating Cloud Functions from the Portfolio project:
- Shared infrastructure (config, middleware, utils, services) copied from portfolio
- Job-specific functionality implemented new for job-finder
- Updated dependencies to latest versions
- Improved project structure and documentation

## Support

For issues, questions, or feature requests:
1. Check existing GitHub issues in manager repo
2. Create new issue with detailed description
3. Tag appropriate team members

## License

[License Type] - See LICENSE file for details
