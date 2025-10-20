/**
 * Secret Configuration
 *
 * Defines secrets using Firebase Functions' params API.
 * Secrets are automatically loaded from Cloud Secret Manager.
 */

import { defineSecret } from "firebase-functions/params"

// Gemini API key from Secret Manager
// Create with: gcloud secrets create GEMINI_API_KEY --data-file=- --project=static-sites-257923
export const geminiApiKey = defineSecret("GEMINI_API_KEY")

// OpenAI API key from Secret Manager
// Create with: gcloud secrets create OPENAI_API_KEY --data-file=- --project=static-sites-257923
export const openaiApiKey = defineSecret("OPENAI_API_KEY")
