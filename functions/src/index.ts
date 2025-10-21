/**
 * Firebase Cloud Functions for Job Finder Application
 *
 * This file exports all Cloud Functions for the Job Finder backend.
 * Functions are organized by feature area.
 */

import * as admin from "firebase-admin"

// Initialize Firebase Admin SDK
admin.initializeApp()

// Export content items functions
export {
  createContentItem,
  getContentItem,
  listContentItems,
  updateContentItem,
  deleteContentItem,
} from "./functions/content-items.function"

// Export experience functions
export {
  createExperience,
  getExperience,
  listExperiences,
  updateExperience,
  deleteExperience,
} from "./functions/experience.function"

// Export generator functions
export {
  generateDocument,
  getGenerationRequest,
  getGenerationResponse,
} from "./functions/generator.function"
