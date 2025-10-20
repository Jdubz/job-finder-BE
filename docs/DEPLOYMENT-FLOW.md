# Deployment Flow Diagram

Visual representation of the staging deployment process.

## Deployment Process

```
┌─────────────────────────────────────────────────────────────┐
│                    STAGING DEPLOYMENT                       │
│                  ./scripts/deploy-staging.sh                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Pre-Deployment Checks                             │
├─────────────────────────────────────────────────────────────┤
│  ✓ Run npm run lint                                        │
│  ✓ Run npm test (30 tests)                                 │
│  ✓ Run npm run build                                       │
│  ✓ Verify dist/ folder exists                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Switch to Staging Project                         │
├─────────────────────────────────────────────────────────────┤
│  ✓ firebase use staging                                    │
│  ✓ Verify project: job-finder-staging                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Deploy Cloud Functions                            │
├─────────────────────────────────────────────────────────────┤
│  ✓ firebase deploy --only functions --force                │
│  ✓ Deploy manageJobQueue function                          │
│  ✓ Configure memory, timeout, environment                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Deploy Firestore Configuration                    │
├─────────────────────────────────────────────────────────────┤
│  ✓ firebase deploy --only firestore:rules,indexes          │
│  ✓ Deploy security rules (9 collections)                   │
│  ✓ Deploy composite indexes (5 indexes)                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: Deploy Storage Rules                              │
├─────────────────────────────────────────────────────────────┤
│  ✓ firebase deploy --only storage                          │
│  ✓ Deploy file storage security rules                      │
│  ✓ Configure file type and size validation                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 6: Verify Deployment                                 │
├─────────────────────────────────────────────────────────────┤
│  ✓ firebase functions:list                                 │
│  ✓ Display deployed functions and URLs                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 7: Next Steps                                        │
├─────────────────────────────────────────────────────────────┤
│  → Run smoke tests: ./scripts/smoke-tests.sh               │
│  → Check logs: firebase functions:log                      │
│  → Monitor in Firebase Console                             │
│  → Test frontend integration                               │
└─────────────────────────────────────────────────────────────┘
```

## Smoke Tests Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     SMOKE TESTS                             │
│                ./scripts/smoke-tests.sh                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TEST 1: Cloud Functions Accessibility                     │
├─────────────────────────────────────────────────────────────┤
│  ✓ Check if staging URL is reachable                       │
│  ✓ Verify functions are deployed                           │
│  ✓ Check HTTP response codes                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TEST 2: Health Check Endpoint                             │
├─────────────────────────────────────────────────────────────┤
│  ✓ Call /health endpoint                                   │
│  ✓ Verify "healthy" or "ok" response                       │
│  ✓ Skip if endpoint not implemented                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TEST 3: Job Queue Management (Authenticated)              │
├─────────────────────────────────────────────────────────────┤
│  ✓ Send authenticated request to manageJobQueue            │
│  ✓ Verify function responds with valid JSON                │
│  ✓ Check authentication is working                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TEST 4: CORS Configuration                                │
├─────────────────────────────────────────────────────────────┤
│  ✓ Send OPTIONS request with Origin header                 │
│  ✓ Check for Access-Control-Allow-Origin header            │
│  ✓ Verify CORS is properly configured                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TEST 5: Rate Limiting Configuration                       │
├─────────────────────────────────────────────────────────────┤
│  ✓ Check for rate limit headers in response                │
│  ✓ Verify rate limiting is active                          │
│  ✓ Report configuration status                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  RESULTS SUMMARY                                           │
├─────────────────────────────────────────────────────────────┤
│  Total Tests: 5                                            │
│  Passed: X                                                 │
│  Failed: Y                                                 │
│  Exit Code: 0 (success) or 1 (failure)                     │
└─────────────────────────────────────────────────────────────┘
```

## Security Rules Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FIRESTORE SECURITY                       │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Authentication│  │  Authorization│  │  Validation   │
├───────────────┤  ├───────────────┤  ├───────────────┤
│ • isAuth()    │  │ • isOwner()   │  │ • Field types │
│ • User token  │  │ • hasEditor() │  │ • Required    │
│ • Valid JWT   │  │ • hasAdmin()  │  │ • Constraints │
└───────────────┘  └───────────────┘  └───────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  COLLECTION RULES                           │
├─────────────────────────────────────────────────────────────┤
│  ✓ users             - User profile data                   │
│  ✓ jobQueue          - Job submissions                     │
│  ✓ jobMatches        - Job matches                         │
│  ✓ config            - System configuration                │
│  ✓ stopList          - Stop list                           │
│  ✓ experience        - User experience items               │
│  ✓ contentItems      - User content items                  │
│  ✓ generatedDocs     - Generated documents                 │
│  ✓ Default deny      - All other paths                     │
└─────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────┐
│                    STORAGE SECURITY                         │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ File Type     │  │  File Size    │  │  Access       │
├───────────────┤  ├───────────────┤  ├───────────────┤
│ • PDF         │  │ • 10MB docs   │  │ • Owner       │
│ • DOCX        │  │ • 5MB images  │  │ • Editor      │
│ • Images      │  │ • Validation  │  │ • Admin       │
└───────────────┘  └───────────────┘  └───────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  STORAGE PATHS                              │
├─────────────────────────────────────────────────────────────┤
│  ✓ /users/{uid}/documents/   - User documents             │
│  ✓ /generated/{uid}/          - Generated files           │
│  ✓ /users/{uid}/profile/      - Profile images            │
│  ✓ /admin/                     - Admin files               │
│  ✓ Default deny                - All other paths           │
└─────────────────────────────────────────────────────────────┘
```

## Monitoring Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  CLOUD FUNCTIONS                            │
│         (manageJobQueue, other functions)                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Metrics & Logs
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLOUD LOGGING                            │
├─────────────────────────────────────────────────────────────┤
│  • Structured logs (JSON)                                  │
│  • Request IDs for tracing                                 │
│  • Error stack traces                                      │
│  • Performance metrics                                     │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│   Dashboards  │  │    Alerts     │  │    Queries    │
├───────────────┤  ├───────────────┤  ├───────────────┤
│ • Invocations │  │ • Error rate  │  │ • Slow reqs   │
│ • Latency     │  │ • Latency     │  │ • Auth fails  │
│ • Errors      │  │ • Crashes     │  │ • User acts   │
│ • Memory      │  │ • Quota       │  │ • Error types │
└───────────────┘  └───────────────┘  └───────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  NOTIFICATION CHANNELS                      │
├─────────────────────────────────────────────────────────────┤
│  • Email      - Direct alerts                              │
│  • Slack      - Team notifications                         │
│  • PagerDuty  - On-call escalation                         │
│  • SMS        - Critical alerts                            │
└─────────────────────────────────────────────────────────────┘
```

## Rollback Process

```
┌─────────────────────────────────────────────────────────────┐
│               ISSUE DETECTED POST-DEPLOYMENT                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Assess Impact                                     │
├─────────────────────────────────────────────────────────────┤
│  • Check error logs                                        │
│  • Review error rate                                       │
│  • Identify affected users                                 │
│  • Determine severity                                      │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
┌──────────────────────┐    ┌──────────────────────┐
│   Minor Issue        │    │   Critical Issue     │
│   (Can wait)         │    │   (Needs rollback)   │
└──────────────────────┘    └──────────────────────┘
                │                       │
                ▼                       ▼
┌──────────────────────┐    ┌─────────────────────────────────┐
│ Fix and Redeploy     │    │  IMMEDIATE ROLLBACK             │
│ • Fix code           │    ├─────────────────────────────────┤
│ • Test locally       │    │ Option 1: Firebase Console      │
│ • Deploy again       │    │  • Go to Functions              │
└──────────────────────┘    │  • Select function              │
                            │  • Click Versions tab           │
                            │  • Rollback to previous         │
                            │                                 │
                            │ Option 2: Git Revert            │
                            │  • git revert <commit>          │
                            │  • npm run build                │
                            │  • firebase deploy --force      │
                            └─────────────────────────────────┘
                                        │
                                        ▼
                            ┌─────────────────────────────────┐
                            │  Verify Rollback                │
                            ├─────────────────────────────────┤
                            │  • Run smoke tests              │
                            │  • Check error rate             │
                            │  • Monitor for 30 minutes       │
                            │  • Notify team                  │
                            └─────────────────────────────────┘
```

## Complete Deployment Timeline

```
Time    Stage                               Status
─────────────────────────────────────────────────────────────
00:00   Start deployment script             🔵 Running
00:01   Run lint                            ✅ Passed
00:02   Run tests (30 tests)                ✅ Passed
00:05   Build production bundle             ✅ Complete
00:06   Switch to staging project           ✅ Switched
00:07   Deploy functions                    🔵 Deploying
00:15   Functions deployed                  ✅ Success
00:16   Deploy Firestore rules              🔵 Deploying
00:18   Firestore rules deployed            ✅ Success
00:19   Deploy Storage rules                🔵 Deploying
00:20   Storage rules deployed              ✅ Success
00:21   Verify deployment                   ✅ Verified
00:22   Deployment complete                 ✅ Done
─────────────────────────────────────────────────────────────
00:23   Run smoke tests                     🔵 Running
00:24   Test 1: Functions accessible        ✅ Passed
00:25   Test 2: Health check                ✅ Passed
00:26   Test 3: Job queue (auth)            ✅ Passed
00:27   Test 4: CORS config                 ✅ Passed
00:28   Test 5: Rate limiting               ✅ Passed
00:29   All smoke tests passed              ✅ Success
─────────────────────────────────────────────────────────────
Total deployment time: ~30 minutes
```

---

**Legend**:
- ✅ Success
- 🔵 In Progress
- ⚠️ Warning
- ❌ Failed

---

For detailed instructions, see:
- [Deployment Guide](DEPLOYMENT.md)
- [Monitoring Guide](MONITORING.md)
- [Completion Summary](../PHASE-6-1-COMPLETE.md)
