/**
 * Secret Configuration
 *
 * Defines secrets using Firebase Functions' params API.
 * Secrets are automatically loaded from Cloud Secret Manager.
 *
 * NOTE: Gemini provider temporarily removed - focusing on OpenAI only for initial implementation
 */

import { defineSecret } from "firebase-functions/params"

// OpenAI API key from Secret Manager
// Create with: gcloud secrets create OPENAI_API_KEY --data-file=- --project=static-sites-257923
export const openaiApiKey = defineSecret("OPENAI_API_KEY")

// Gemini API key - TEMPORARILY REMOVED
// Will add back when we expand to multi-provider support
// export const geminiApiKey = defineSecret("GEMINI_API_KEY")
