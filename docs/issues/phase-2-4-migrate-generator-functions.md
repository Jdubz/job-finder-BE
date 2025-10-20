# PHASE-2-4 — Migrate AI Generator Functions from Portfolio

> **Context**: See [API.md](../../API.md) for generator API specifications and [README.md](../../README.md) for AI integration overview
> **Architecture**: Firebase callable functions for AI-powered resume and cover letter generation

---

## Issue Metadata

```yaml
Title: PHASE-2-4 — Migrate AI Generator Functions from Portfolio
Labels: priority-p1, repository-backend, type-migration, status-todo, phase-2
Assignee: Worker A
Priority: P1-High
Estimated Effort: 10-14 hours
Repository: job-finder-BE
```

---

## Summary

**Problem**: AI document generation functions (resume and cover letter generation) currently exist in the portfolio repository and need to be migrated to job-finder-BE. These functions integrate with Claude/GPT APIs, use Handlebars templates, and generate PDF documents.

**Goal**: Migrate complete AI document generation system from portfolio including generator functions, AI provider services (Claude, OpenAI, Gemini), PDF generation service, Handlebars templates, and storage integration.

**Impact**: Enables users to generate AI-customized resumes and cover letters tailored to specific job postings. Core value proposition of the job-finder application.

---

## Architecture References

> **📚 Read these docs first for context:**

- **[API.md](../../API.md)** - Generator API endpoint specifications
- **[BACKEND_MIGRATION_PLAN.md](../../../docs/architecture/BACKEND_MIGRATION_PLAN.md)** - Phase 2, Task 2.4
- **Portfolio Source**: `/home/jdubz/Development/portfolio/functions/src/` (generator, resume, AI services)

**Key concepts to understand**:
- AI Provider Pattern: Factory pattern for switching between Claude/OpenAI/Gemini
- Template System: Handlebars templates for document structure
- PDF Generation: HTML-to-PDF conversion with proper formatting

---

## Tasks

### Phase 1: Migrate Core Generator Functions
1. **Migrate generateDocument function**
   - What: Copy main document generation function from portfolio
   - Where: `src/generator/generate-document.ts`
   - Why: Primary endpoint for AI document generation
   - Test: Function accepts job match, generates customized document

2. **Migrate getGenerationHistory function**
   - What: Copy function to retrieve user's generation history
   - Where: `src/generator/get-generation-history.ts`
   - Why: Users need to see and access previously generated documents
   - Test: Function returns paginated history for user

3. **Migrate getUserDefaults function**
   - What: Copy function to get/set user default settings
   - Where: `src/generator/get-user-defaults.ts`
   - Why: Users can save preferred templates and settings
   - Test: Function returns user's default preferences

4. **Migrate deleteDocument function**
   - What: Copy function to delete generated documents
   - Where: `src/generator/delete-document.ts`
   - Why: Users need to remove unwanted documents
   - Test: Function deletes document and storage file

### Phase 2: Migrate AI Provider Services
5. **Migrate AI provider factory**
   - What: Copy factory pattern for AI provider selection
   - Where: `src/services/ai-provider.factory.ts`
   - Why: Enables switching between Claude/OpenAI/Gemini
   - Test: Factory returns correct provider based on config

6. **Migrate Claude service**
   - What: Copy Anthropic Claude API integration
   - Where: `src/services/claude.service.ts`
   - Why: Primary AI provider for document generation
   - Test: Service generates content using Claude API

7. **Migrate OpenAI service**
   - What: Copy OpenAI GPT API integration
   - Where: `src/services/openai.service.ts`
   - Why: Alternative AI provider option
   - Test: Service generates content using GPT API

8. **Migrate Gemini service (if exists)**
   - What: Copy Google Gemini API integration
   - Where: `src/services/gemini.service.ts`
   - Why: Additional AI provider option
   - Test: Service generates content using Gemini API

### Phase 3: Migrate PDF and Storage Services
9. **Migrate PDF service**
   - What: Copy PDF generation service (HTML to PDF)
   - Where: `src/services/pdf.service.ts`
   - Why: Converts HTML templates to downloadable PDFs
   - Test: Service generates valid PDF from HTML

10. **Migrate storage service**
    - What: Copy Firebase Storage integration
    - Where: `src/services/storage.service.ts`
    - Why: Stores generated PDFs for user download
    - Test: Service uploads and retrieves PDFs from Storage

### Phase 4: Migrate Templates and Business Logic
11. **Migrate Handlebars templates**
    - What: Copy all document templates (.hbs files)
    - Where: `src/templates/` (resume-modern.hbs, cover-letter-professional.hbs, etc.)
    - Why: Templates structure the generated documents
    - Test: Templates compile and render with sample data

12. **Create GeneratorService**
    - What: Extract and organize business logic into service layer
    - Where: `src/services/generator.service.ts`
    - Why: Separates orchestration logic from function handlers
    - Test: Service coordinates AI, PDF, and storage operations

---

## Technical Details

### Files to Migrate/Create

```
COPY FROM PORTFOLIO:
- portfolio/functions/src/generator.ts → src/generator/
  - Split into individual function files

- portfolio/functions/src/resume.ts → src/generator/resume-specific.ts

- portfolio/functions/src/services/ai-provider.factory.ts → src/services/
- portfolio/functions/src/services/claude.service.ts → src/services/
- portfolio/functions/src/services/openai.service.ts → src/services/
- portfolio/functions/src/services/gemini.service.ts → src/services/
- portfolio/functions/src/services/pdf.service.ts → src/services/
- portfolio/functions/src/services/storage.service.ts → src/services/

- portfolio/functions/src/templates/*.hbs → src/templates/

CREATE NEW:
- src/generator/generate-document.ts - Main generation function
- src/generator/get-generation-history.ts - History retrieval
- src/generator/get-user-defaults.ts - User defaults
- src/generator/delete-document.ts - Document deletion
- src/services/generator.service.ts - Business logic orchestration
- src/types/generator.types.ts - TypeScript types
- src/__tests__/generator.test.ts - Unit tests

MODIFY:
- src/index.ts - Export all generator functions
- package.json - Add dependencies (puppeteer, handlebars, @anthropic-ai/sdk, openai)
```

### Key Implementation Notes

**Generate Document Function**:
```typescript
// src/generator/generate-document.ts
import * as functions from 'firebase-functions';
import { GeneratorService } from '@/services/generator.service';
import { logger } from '@/utils/logger';

export const generateDocument = functions
  .runWith({ timeoutSeconds: 540, memory: '2GB' }) // PDF generation needs resources
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { type, jobMatchId, template, customizations } = data;

    // Validate inputs
    if (!type || !['resume', 'cover_letter'].includes(type)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid document type');
    }

    // Generate document
    const service = new GeneratorService();
    const result = await service.generateDocument({
      userId: context.auth.uid,
      type,
      jobMatchId,
      template: template || 'default',
      customizations: customizations || {},
    });

    logger.info('Document generated', {
      userId: context.auth.uid,
      type,
      documentId: result.id
    });

    return result;
  });
```

**Generator Service** (orchestration):
```typescript
// src/services/generator.service.ts
import { AIProviderFactory } from './ai-provider.factory';
import { PDFService } from './pdf.service';
import { StorageService } from './storage.service';
import { ConfigService } from './config.service';
import Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

export class GeneratorService {
  private aiProviderFactory = new AIProviderFactory();
  private pdfService = new PDFService();
  private storageService = new StorageService();
  private configService = new ConfigService();

  async generateDocument(params: GenerateDocumentParams): Promise<GeneratedDocument> {
    // 1. Fetch job match and user content
    const jobMatch = await this.getJobMatch(params.jobMatchId);
    const contentItems = await this.getContentItems(params.userId);

    // 2. Get AI settings and select provider
    const aiSettings = await this.configService.getAISettings();
    const aiProvider = this.aiProviderFactory.getProvider(aiSettings.provider);

    // 3. Generate customized content using AI
    const aiContent = await aiProvider.generateContent({
      type: params.type,
      jobDescription: jobMatch.description,
      userExperience: contentItems,
      customizations: params.customizations,
    });

    // 4. Render template with AI-generated content
    const template = this.loadTemplate(params.template);
    const html = template({ ...aiContent, ...contentItems });

    // 5. Generate PDF
    const pdfBuffer = await this.pdfService.generatePDF(html);

    // 6. Upload to Storage
    const fileName = `${params.userId}/${params.type}_${Date.now()}.pdf`;
    const downloadUrl = await this.storageService.uploadFile(fileName, pdfBuffer);

    // 7. Save to generation history
    const historyRecord = await this.saveToHistory({
      userId: params.userId,
      type: params.type,
      jobMatchId: params.jobMatchId,
      documentUrl: downloadUrl,
      template: params.template,
      aiProvider: aiSettings.provider,
      aiModel: aiSettings.model,
    });

    return {
      id: historyRecord.id,
      downloadUrl,
      type: params.type,
      createdAt: new Date().toISOString(),
    };
  }

  private loadTemplate(templateName: string): HandlebarsTemplateDelegate {
    const templatePath = path.join(__dirname, '../templates', `${templateName}.hbs`);
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    return Handlebars.compile(templateContent);
  }
}
```

**AI Provider Interface**:
```typescript
// src/services/ai-provider.interface.ts
export interface AIProvider {
  generateContent(params: GenerateContentParams): Promise<GeneratedContent>;
}

export interface GenerateContentParams {
  type: 'resume' | 'cover_letter';
  jobDescription: string;
  userExperience: ContentItem[];
  customizations: Record<string, any>;
}

export interface GeneratedContent {
  summary: string;
  experience: string[];
  skills: string[];
  achievements: string[];
  // ... other fields
}
```

**Claude Service**:
```typescript
// src/services/claude.service.ts
import Anthropic from '@anthropic-ai/sdk';
import { SecretManagerService } from './secret-manager.service';
import { AIProvider, GenerateContentParams, GeneratedContent } from './ai-provider.interface';

export class ClaudeService implements AIProvider {
  private client: Anthropic;

  async initialize() {
    const secretManager = new SecretManagerService();
    const apiKey = await secretManager.getSecret('anthropic-api-key');
    this.client = new Anthropic({ apiKey });
  }

  async generateContent(params: GenerateContentParams): Promise<GeneratedContent> {
    const prompt = this.buildPrompt(params);

    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    return this.parseResponse(response.content[0].text);
  }

  private buildPrompt(params: GenerateContentParams): string {
    // Construct prompt for AI...
  }
}
```

**Dependencies to Add**:
```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.1",
    "openai": "^4.73.0",
    "@google/generative-ai": "^0.21.0",
    "handlebars": "^4.7.8",
    "puppeteer": "^23.11.1"
  }
}
```

---

## Acceptance Criteria

- [ ] **generateDocument works**: Can generate resume and cover letter
- [ ] **Generation history works**: Can retrieve and paginate history
- [ ] **User defaults work**: Can get/set default preferences
- [ ] **Delete document works**: Can delete documents and files
- [ ] **AI providers migrated**: Claude, OpenAI, Gemini services working
- [ ] **PDF generation works**: HTML converts to properly formatted PDF
- [ ] **Storage integration works**: PDFs uploaded and downloadable
- [ ] **Templates migrated**: All Handlebars templates render correctly
- [ ] **Service layer complete**: GeneratorService orchestrates workflow
- [ ] **Tests passing**: Unit tests for all functions and services
- [ ] **Functions deployed**: All generator functions in Firebase console

---

## Testing

### Test Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run unit tests
npm test generator.test.ts

# Start emulator
npm run serve

# Deploy to staging
npm run deploy:staging
```

### Manual Testing

```bash
# Step 1: Start emulator
npm run serve

# Step 2: Generate resume (requires auth token and job match)
curl -X POST http://localhost:5001/{project-id}/us-central1/generateDocument \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "type": "resume",
      "jobMatchId": "match-id-123",
      "template": "modern",
      "customizations": {
        "emphasize": ["React", "TypeScript", "Firebase"]
      }
    }
  }'

# Step 3: Check generation history
curl -X POST http://localhost:5001/{project-id}/us-central1/getGenerationHistory \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data": {}}'

# Step 4: Verify PDF in Storage
# Check Firebase console → Storage → generated documents folder

# Step 5: Download and verify PDF
# Open download URL from response
# Verify PDF renders correctly
```

---

## Commit Message Template

```
feat(generator): migrate AI generator functions from portfolio

Migrate complete AI document generation system from portfolio including
generator functions, AI provider services (Claude, OpenAI, Gemini), PDF
generation, storage integration, and Handlebars templates. Enables AI-powered
resume and cover letter customization.

Key changes:
- Migrate generateDocument, getGenerationHistory, getUserDefaults, deleteDocument functions
- Migrate AI provider factory and service implementations (Claude, OpenAI, Gemini)
- Migrate PDF generation service with Puppeteer
- Migrate Firebase Storage service for document uploads
- Migrate Handlebars templates for document structure
- Create GeneratorService for workflow orchestration
- Add comprehensive unit tests
- Update dependencies (Anthropic SDK, OpenAI SDK, Puppeteer, Handlebars)

Testing:
- Document generation works with all AI providers
- PDF generation produces properly formatted documents
- Storage uploads and retrieval working
- Templates render correctly with sample data
- All unit tests pass

Closes #8
```

---

## Related Issues

- **Depends on**: #2, #4, #6 (Infrastructure, secrets, Firestore)
- **Blocks**: Frontend document builder workflows
- **Related**: API.md generator endpoints, BACKEND_MIGRATION_PLAN.md Phase 2

---

## Resources

### Documentation
- **Anthropic Claude API**: https://docs.anthropic.com/
- **OpenAI API**: https://platform.openai.com/docs/
- **Google Generative AI**: https://ai.google.dev/docs
- **Puppeteer**: https://pptr.dev/
- **Handlebars**: https://handlebarsjs.com/

---

## Success Metrics

**How we'll measure success**:
- Documents generated successfully with all AI providers
- < 10 second generation time for resumes
- < 15 second generation time for cover letters
- PDF quality matches or exceeds manual formatting
- 100% template rendering success rate

---

## Notes

**Implementation Tips**:
- Test each AI provider separately before integration
- Use Puppeteer headless mode for PDF generation
- Cache templates to avoid repeated file reads
- Implement retry logic for AI API calls (rate limits)
- Add cost tracking for AI API usage
- Validate generated content before PDF creation
- Test PDF rendering across multiple viewers
- Consider memory limits for PDF generation (use 2GB)
- Set appropriate function timeouts (540s for generation)

**Memory Requirements**:
- PDF generation with Puppeteer requires at least 1GB memory
- Recommend 2GB for production to handle concurrent requests

---

**Created**: 2025-10-20
**Created By**: PM
**Last Updated**: 2025-10-20
**Status**: Todo
