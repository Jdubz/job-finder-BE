# Job Finder Backend (Firebase Cloud Functions)

Firebase Cloud Functions backend for the Job Finder Application.

## Architecture

This repository contains Firebase Cloud Functions for:
- **Generator API** - AI-powered resume and cover letter generation
- **Content Items API** - Content and experience management
- **Job Queue API** - Job queue management (coordinated with Worker A)

## Technology Stack

- **Runtime**: Node.js 20
- **Language**: TypeScript
- **Platform**: Firebase Cloud Functions (2nd gen)
- **Database**: Cloud Firestore
- **Storage**: Cloud Storage
- **Secrets**: Google Cloud Secret Manager

## Project Structure

```
functions/
├── src/
│   ├── config/          # Configuration files
│   ├── middleware/      # Auth, rate limiting, app check
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript type definitions
│   ├── templates/       # Handlebars templates for documents
│   ├── generator.ts     # AI document generation functions
│   ├── content-items.ts # Content management functions
│   ├── experience.ts    # Experience management functions
│   ├── resume.ts        # Resume-specific functions
│   └── index.ts         # Main exports
├── dist/                # Compiled JavaScript (gitignored)
├── package.json         # Dependencies
└── tsconfig.json        # TypeScript configuration
```

## Development

### Prerequisites

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase project access

### Setup

```bash
cd functions
npm install
```

### Local Development

```bash
# Start emulators
npm run serve

# Build and watch for changes
npm run dev
```

### Testing

```bash
npm test
npm run test:watch
```

### Deployment

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

## Environment Variables

Secrets are managed via Google Cloud Secret Manager:
- `AI_API_KEY` - API key for AI service (Gemini/OpenAI)
- `EMAIL_API_KEY` - Email service API key
- Other secrets as needed

## Related Repositories

- `job-finder` - Python queue worker for job scraping
- `job-finder-FE` - React frontend application
- `job-finder-shared-types` - Shared TypeScript types

## License

Private - All Rights Reserved
