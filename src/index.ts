/**
 * Firebase Cloud Functions for Job Finder Application
 * 
 * This file exports all Cloud Functions for the Job Finder backend.
 * Functions are organized by feature area (job queue, matches, config, etc.)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

// TODO: Import and export job queue functions
// export { submitJob, submitScrape, submitCompany, getQueue, getQueueStats } from './job-queue';

// TODO: Import and export job matches functions
// export { getMatches, updateMatch } from './job-matches';

// TODO: Import and export config functions
// export { getConfig, updateConfig } from './config';

/**
 * Health check endpoint
 * GET /health
 */
export const health = functions.https.onRequest((req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'job-finder-backend',
    version: '1.0.0'
  });
});
