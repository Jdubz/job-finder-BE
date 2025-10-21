#!/usr/bin/env ts-node

/**
 * Remove Editor Role from User
 *
 * This script removes the "editor" role from a user in Firestore.
 *
 * Usage:
 *   npm run script:remove-editor -- <user-id> <environment>
 *
 * Examples:
 *   npm run script:remove-editor -- user123 local
 *   npm run script:remove-editor -- user456 staging
 *   npm run script:remove-editor -- user789 production
 *
 * Environments:
 *   local      - Firebase emulator (localhost:8080)
 *   staging    - portfolio-staging database
 *   production - (default) database
 */

import * as admin from 'firebase-admin';
import * as readline from 'readline';

// Environment configuration
const ENVIRONMENTS = {
  local: {
    projectId: 'demo-project',
    database: '(default)',
    useEmulator: true,
  },
  staging: {
    projectId: 'static-sites-257923',
    database: 'portfolio-staging',
    useEmulator: false,
  },
  production: {
    projectId: 'static-sites-257923',
    database: '(default)',
    useEmulator: false,
  },
};

type Environment = keyof typeof ENVIRONMENTS;

/**
 * Prompt user for confirmation
 */
function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Initialize Firebase Admin
 */
function initializeFirebase(environment: Environment): admin.firestore.Firestore {
  const config = ENVIRONMENTS[environment];

  if (config.useEmulator) {
    // Local emulator
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    admin.initializeApp({
      projectId: config.projectId,
    });
    console.log('📍 Connected to Firebase Emulator');
  } else {
    // Production/Staging
    admin.initializeApp({
      projectId: config.projectId,
    });
    console.log(`📍 Connected to Firebase project: ${config.projectId}`);
  }

  const db = admin.firestore();

  // Set database if not default
  if (config.database !== '(default)') {
    const dbWithName = db as unknown as { databaseId: string };
    dbWithName.databaseId = config.database;
  }

  return db;
}

/**
 * Remove editor role from user
 */
async function removeEditorRole(
  db: admin.firestore.Firestore,
  userId: string,
  environment: Environment
): Promise<void> {
  const config = ENVIRONMENTS[environment];

  console.log('\n🔍 Checking user...');
  console.log(`   User ID: ${userId}`);
  console.log(`   Environment: ${environment}`);
  console.log(`   Project: ${config.projectId}`);
  console.log(`   Database: ${config.database}`);

  // Check if user exists
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    console.error(`\n❌ Error: User ${userId} not found`);
    process.exit(1);
  }

  const userData = userDoc.data();
  console.log('\n📄 Current user data:');
  console.log(JSON.stringify(userData, null, 2));

  // Check if user has editor role
  if (userData?.role !== 'editor') {
    console.log(`\n⚠️  User ${userId} does not have editor role`);
    console.log(`   Current role: ${userData?.role || 'none'}`);
    const shouldContinue = await confirm('Continue anyway?');
    if (!shouldContinue) {
      console.log('❌ Aborted');
      process.exit(0);
    }
  }

  // Confirmation for production
  if (environment === 'production') {
    console.log('\n⚠️  WARNING: You are modifying PRODUCTION data');
    const confirmed = await confirm('Are you sure you want to continue?');
    if (!confirmed) {
      console.log('❌ Aborted');
      process.exit(0);
    }
  }

  // Remove editor role
  console.log('\n✏️  Removing editor role...');
  await userRef.update({
    role: admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log('✅ Editor role removed successfully!');

  // Verify update
  const updatedDoc = await userRef.get();
  const updatedData = updatedDoc.data();
  console.log('\n📄 Updated user data:');
  console.log(JSON.stringify(updatedData, null, 2));
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: npm run script:remove-editor -- <user-id> <environment>');
    console.error('');
    console.error('Environments: local, staging, production');
    console.error('');
    console.error('Examples:');
    console.error('  npm run script:remove-editor -- user123 local');
    console.error('  npm run script:remove-editor -- user456 staging');
    console.error('  npm run script:remove-editor -- user789 production');
    process.exit(1);
  }

  const userId = args[0];
  const environment = args[1] as Environment;

  if (!ENVIRONMENTS[environment]) {
    console.error(`❌ Error: Invalid environment "${environment}"`);
    console.error('Valid environments: local, staging, production');
    process.exit(1);
  }

  try {
    const db = initializeFirebase(environment);
    await removeEditorRole(db, userId, environment);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
