# PHASE-1-1 — Initialize Firebase Functions Project Structure

> **Context**: See [README.md](../../README.md) for project overview, tech stack, and development environment
> **Architecture**: Firebase Cloud Functions (2nd gen) + TypeScript + Express middleware

---

## Issue Metadata

```yaml
Title: PHASE-1-1 — Initialize Firebase Functions Project Structure
Labels: priority-p1, repository-backend, type-setup, status-todo, phase-1
Assignee: Worker A
Priority: P1-High
Estimated Effort: 4-6 hours
Repository: job-finder-BE
```

---

## Summary

**Problem**: The job-finder-BE repository needs a complete Firebase Functions project structure with TypeScript, ESLint, proper configuration files, and development scripts to support backend API development.

**Goal**: Set up a production-ready Firebase Functions (2nd gen) project with TypeScript support, linting, testing infrastructure, and clear documentation.

**Impact**: Enables all backend development work for job queue management, AI document generation, and configuration APIs. Establishes code quality standards and development workflows.

---

## Architecture References

> **📚 Read these docs first for context:**

- **[README.md](../../README.md)** - Complete repository overview, architecture, development commands
- **[API.md](../../API.md)** - API endpoint specifications and examples
- **[BACKEND_MIGRATION_PLAN.md](../../../docs/architecture/BACKEND_MIGRATION_PLAN.md)** - Migration strategy from portfolio

**Key concepts to understand**:
- Firebase Cloud Functions (2nd gen): Modern function runtime with improved performance
- TypeScript Setup: Strict typing for reliability and maintainability
- Project Structure: Organized by feature (job-queue, generator, content-items)

---

## Tasks

### Phase 1: Initialize Firebase Project
1. **Run firebase init functions**
   - What: Initialize Firebase Functions in the repository root
   - Where: `/home/jdubz/Development/job-finder-app-manager/job-finder-BE/`
   - Why: Sets up Firebase project structure and configuration
   - Test: `firebase` command works, `firebase.json` created

2. **Configure TypeScript**
   - What: Select TypeScript, set up strict mode, configure path aliases
   - Where: `tsconfig.json`
   - Why: Type safety prevents runtime errors and improves code quality
   - Test: `npm run build` compiles without errors

3. **Configure ESLint**
   - What: Set up ESLint with TypeScript rules and Firebase recommendations
   - Where: `eslint.config.mjs` or `.eslintrc.js`
   - Why: Enforces consistent code style and catches common errors
   - Test: `npm run lint` passes on initial code

### Phase 2: Project Structure Setup
4. **Create source directory structure**
   - What: Set up organized folder hierarchy
   - Where: Create `src/config/`, `src/middleware/`, `src/services/`, `src/types/`, `src/utils/`, `src/__tests__/`
   - Why: Organized structure supports maintainability and scalability
   - Test: All directories exist and are recognized by TypeScript

5. **Configure package.json scripts**
   - What: Add development, build, test, lint, and deployment scripts
   - Where: `package.json`
   - Why: Standardized commands for all development workflows
   - Test: Each script executes successfully

6. **Set up firebase.json**
   - What: Configure functions runtime (Node.js 20), region (us-central1), memory/timeout settings
   - Where: `firebase.json`
   - Why: Controls function deployment and runtime behavior
   - Test: `firebase deploy --dry-run` validates configuration

### Phase 3: Documentation and Examples
7. **Create comprehensive README**
   - What: Document setup, development commands, deployment, architecture
   - Where: `README.md`
   - Why: Enables other developers to quickly understand and contribute
   - Test: README is clear and complete

8. **Add example .env and documentation**
   - What: Create `.env.example` with all required environment variables
   - Where: `.env.example`
   - Why: Developers know what configuration is needed
   - Test: All environment variables documented

---

## Technical Details

### Files to Create

```
CREATE:
- firebase.json - Firebase project configuration
- .firebaserc - Firebase project aliases (staging, production)
- tsconfig.json - TypeScript compiler configuration
- eslint.config.mjs - ESLint rules and configuration
- package.json - Dependencies and scripts
- .gitignore - Ignore node_modules, dist, .env files
- .env.example - Environment variable template
- README.md - Complete project documentation
- src/index.ts - Functions entry point (empty, ready for exports)
- src/config/.gitkeep - Config directory placeholder
- src/middleware/.gitkeep - Middleware directory placeholder
- src/services/.gitkeep - Services directory placeholder
- src/types/.gitkeep - Types directory placeholder
- src/utils/.gitkeep - Utils directory placeholder
- src/__tests__/.gitkeep - Tests directory placeholder
- jest.config.js - Jest testing configuration
```

### Key Implementation Notes

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "outDir": "dist",
    "sourceMap": true,
    "strict": true,
    "target": "ES2020",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**firebase.json**:
```json
{
  "functions": {
    "source": ".",
    "runtime": "nodejs20",
    "ignore": [
      "node_modules",
      ".git",
      "firebase-debug.log",
      "firebase-debug.*.log"
    ],
    "predeploy": [
      "npm run lint",
      "npm run build"
    ]
  }
}
```

**package.json scripts**:
```json
{
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "serve": "npm run build && firebase emulators:start --only functions",
    "shell": "npm run build && firebase functions:shell",
    "start": "npm run serve",
    "deploy": "firebase deploy --only functions",
    "deploy:staging": "firebase use staging && firebase deploy --only functions",
    "deploy:production": "firebase use production && firebase deploy --only functions",
    "logs": "firebase functions:log",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

**Dependencies to Install**:
```json
{
  "dependencies": {
    "firebase-admin": "^13.5.0",
    "firebase-functions": "^6.5.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.6",
    "@typescript-eslint/eslint-plugin": "^8.20.0",
    "@typescript-eslint/parser": "^8.20.0",
    "eslint": "^9.20.0",
    "jest": "^29.7.0",
    "typescript": "^5.7.3",
    "@types/jest": "^29.5.14",
    "ts-jest": "^29.2.6"
  }
}
```

---

## Acceptance Criteria

- [ ] **Firebase initialized**: `firebase.json` and `.firebaserc` configured correctly
- [ ] **TypeScript compiles**: `npm run build` creates `dist/` folder with compiled JavaScript
- [ ] **ESLint configured**: `npm run lint` runs without errors on initial code
- [ ] **Jest configured**: `npm test` runs (even if no tests yet)
- [ ] **Project structure**: All source directories created and organized
- [ ] **Scripts work**: All package.json scripts execute successfully
- [ ] **Documentation complete**: README explains setup, development, and deployment
- [ ] **Environment template**: `.env.example` documents all required variables

---

## Testing

### Test Commands

```bash
# Verify Firebase CLI
firebase --version

# Initialize project
firebase init functions

# Install dependencies
npm install

# Build TypeScript
npm run build

# Verify build output
ls dist/

# Run linting
npm run lint

# Run tests
npm test

# Start emulator
npm run serve
```

### Manual Testing

```bash
# Step 1: Verify project structure
tree -L 3 -I 'node_modules|dist'
# Should show organized directory structure

# Step 2: Check TypeScript compilation
npm run build
# Should create dist/ folder with index.js

# Step 3: Verify Firebase configuration
firebase use --add
# Should allow selecting/adding Firebase project

# Step 4: Test emulator
npm run serve
# Should start Functions emulator on port 5001
```

---

## Commit Message Template

```
feat(setup): initialize Firebase Functions project structure

Initialize complete Firebase Functions (2nd gen) project with TypeScript,
ESLint, Jest, and organized directory structure. Includes development
scripts, environment configuration templates, and comprehensive documentation.

Key changes:
- Initialize Firebase Functions with TypeScript
- Configure strict TypeScript compilation with path aliases
- Set up ESLint with TypeScript rules
- Configure Jest for testing
- Create organized source directory structure (config, middleware, services, types, utils)
- Add development, build, and deployment scripts
- Create README with setup and development instructions
- Add .env.example with environment variable documentation

Testing:
- npm run build compiles successfully
- npm run lint passes
- npm test executes (no tests yet)
- firebase emulators:start works

Closes #1
```

---

## Related Issues

- **Blocks**: #2 (Copy shared infrastructure), #3 (CI/CD setup), #4 (Firebase secrets)
- **Related**: BACKEND_MIGRATION_PLAN.md Phase 1 Tasks

---

## Resources

### Documentation
- **Firebase Functions**: https://firebase.google.com/docs/functions
- **TypeScript**: https://www.typescriptlang.org/docs/
- **ESLint**: https://eslint.org/docs/latest/
- **Jest**: https://jestjs.io/docs/getting-started

### External References
- **Firebase Functions 2nd Gen**: https://firebase.google.com/docs/functions/2nd-gen
- **Node.js 20 Runtime**: https://cloud.google.com/functions/docs/concepts/nodejs-runtime

---

## Success Metrics

**How we'll measure success**:
- Build time: < 10 seconds for initial compilation
- Emulator startup: < 15 seconds
- Zero TypeScript errors with strict mode enabled
- Zero ESLint errors on initial code
- All npm scripts execute without errors

---

## Notes

**Questions? Need clarification?**
- Comment on this issue with specific questions
- Tag @PM for guidance
- Reference BACKEND_MIGRATION_PLAN.md for context

**Implementation Tips**:
- Use `firebase init` to generate boilerplate - don't write from scratch
- Enable strict TypeScript mode from the start - easier than adding later
- Test emulator before proceeding to ensure Firebase CLI is configured correctly
- Keep initial index.ts minimal - just exports empty object for now

---

**Created**: 2025-10-20
**Created By**: PM
**Last Updated**: 2025-10-20
**Status**: Todo
