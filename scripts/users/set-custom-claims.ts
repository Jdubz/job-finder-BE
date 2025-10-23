#!/usr/bin/env ts-node

/**
 * Set Firebase Auth Custom Claims
 *
 * This script sets custom claims on Firebase Authentication tokens.
 * This is DIFFERENT from updating Firestore documents.
 *
 * Custom claims are included in the JWT token and are checked by:
 * - Cloud Functions auth middleware (request.auth.token.role)
 * - Firestore security rules (request.auth.token.role)
 *
 * Usage:
 *   npm run script:set-claims -- <user-id> <role> <environment>
 *
 * Examples:
 *   npm run script:set-claims -- user123 editor local
 *   npm run script:set-claims -- user456 viewer staging
 *   npm run script:set-claims -- user789 admin production
 *
 * Roles:
 *   viewer     - Can read own data
 *   editor     - Can create and manage own content
 *   admin      - Full access to all resources
 *
 * Environments:
 *   local      - Firebase emulator (localhost:9099) - (default) database
 *   staging    - portfolio-staging database
 *   production - portfolio database
 */

import * as admin from 'firebase-admin';
import * as readline from 'readline';

// Environment configuration
const ENVIRONMENTS = {
  local: {
    projectId: 'demo-project',
    database: '(default)',
    useEmulator: true,
    authEmulatorHost: 'localhost:9099',
  },
  staging: {
    projectId: 'static-sites-257923',
    database: 'portfolio-staging',
    useEmulator: false,
  },
  production: {
    projectId: 'static-sites-257923',
    database: 'portfolio',
    useEmulator: false,
  },
};

type Environment = keyof typeof ENVIRONMENTS;
type Role = 'viewer' | 'editor' | 'admin';

const VALID_ROLES: Role[] = ['viewer', 'editor', 'admin'];

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
function initializeFirebase(environment: Environment): {
  auth: admin.auth.Auth;
  db: admin.firestore.Firestore;
} {
  const config = ENVIRONMENTS[environment];

  if (config.useEmulator) {
    // Local emulator
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = config.authEmulatorHost;

    admin.initializeApp({
      projectId: config.projectId,
    });
    console.log('📍 Connected to Firebase Emulators');
    console.log(`   Auth: ${config.authEmulatorHost}`);
    console.log('   Firestore: localhost:8080');
  } else {
    // Production/Staging
    admin.initializeApp({
      projectId: config.projectId,
    });
    console.log(`📍 Connected to Firebase project: ${config.projectId}`);
  }

  const auth = admin.auth();
  const db = admin.firestore();

  // Set database if not default
  if (config.database !== '(default)') {
    const dbWithName = db as unknown as { databaseId: string };
    dbWithName.databaseId = config.database;
  }

  return { auth, db };
}

/**
 * Set custom claims for user
 */
async function setCustomClaims(
  auth: admin.auth.Auth,
  db: admin.firestore.Firestore,
  userId: string,
  role: Role,
  environment: Environment
): Promise<void> {
  const config = ENVIRONMENTS[environment];

  console.log('\n🔍 Checking user...');
  console.log(`   User ID: ${userId}`);
  console.log(`   Role: ${role}`);
  console.log(`   Environment: ${environment}`);
  console.log(`   Project: ${config.projectId}`);
  console.log(`   Database: ${config.database}`);

  // Get user from Firebase Auth
  let userRecord: admin.auth.UserRecord;
  try {
    userRecord = await auth.getUser(userId);
  } catch (error) {
    console.error(`\n❌ Error: User ${userId} not found in Firebase Auth`);
    console.error('   Make sure the user exists and the ID is correct');
    process.exit(1);
  }

  console.log('\n📄 Current user info:');
  console.log(`   Email: ${userRecord.email}`);
  console.log(`   Email Verified: ${userRecord.emailVerified}`);
  console.log(`   Disabled: ${userRecord.disabled}`);
  console.log(`   Created: ${new Date(userRecord.metadata.creationTime).toLocaleString()}`);

  // Show current custom claims
  const currentClaims = userRecord.customClaims || {};
  console.log('\n🔖 Current custom claims:');
  if (Object.keys(currentClaims).length === 0) {
    console.log('   (none)');
  } else {
    console.log(JSON.stringify(currentClaims, null, 2));
  }

  // Check if user already has this role
  if (currentClaims.role === role) {
    console.log(`\n⚠️  User ${userId} already has role: ${role}`);
    const shouldContinue = await confirm('Continue anyway?');
    if (!shouldContinue) {
      console.log('❌ Aborted');
      process.exit(0);
    }
  }

  // Warn if email not verified
  if (!userRecord.emailVerified && environment !== 'local') {
    console.log('\n⚠️  WARNING: Email address is not verified');
    console.log('   User may not be able to access editor-protected endpoints');
    const shouldContinue = await confirm('Continue anyway?');
    if (!shouldContinue) {
      console.log('❌ Aborted');
      process.exit(0);
    }
  }

  // Confirmation for production
  if (environment === 'production') {
    console.log('\n⚠️  WARNING: You are modifying PRODUCTION authentication claims');
    const confirmed = await confirm('Are you sure you want to continue?');
    if (!confirmed) {
      console.log('❌ Aborted');
      process.exit(0);
    }
  }

  // Set custom claims on Auth token
  console.log('\n✏️  Setting custom claims on Firebase Auth token...');
  await auth.setCustomUserClaims(userId, {
    ...currentClaims,
    role,
  });

  console.log('✅ Custom claims set successfully!');

  // Update Firestore document (optional, for UI display)
  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      await userRef.update({
        role,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('✅ Firestore document updated');
    } else {
      console.log('⚠️  User document not found in Firestore - skipping Firestore update');
    }
  } catch (error) {
    console.log('⚠️  Could not update Firestore document:', error);
    console.log('   (This is optional - custom claims are already set on Auth token)');
  }

  // Verify custom claims were set
  const updatedUser = await auth.getUser(userId);
  const updatedClaims = updatedUser.customClaims || {};
  console.log('\n🔖 Updated custom claims:');
  console.log(JSON.stringify(updatedClaims, null, 2));

  console.log('\n⚠️  IMPORTANT: User must sign out and sign back in for claims to take effect');
  console.log('   Or call auth.currentUser.getIdToken(true) to force refresh');
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('Usage: npm run script:set-claims -- <user-id> <role> <environment>');
    console.error('');
    console.error('Roles: viewer, editor, admin');
    console.error('Environments: local, staging, production');
    console.error('');
    console.error('Examples:');
    console.error('  npm run script:set-claims -- user123 editor local');
    console.error('  npm run script:set-claims -- user456 viewer staging');
    console.error('  npm run script:set-claims -- user789 admin production');
    console.error('');
    console.error('Role Permissions:');
    console.error('  viewer  - Can read own data');
    console.error('  editor  - Can create and manage own content');
    console.error('  admin   - Full access to all resources');
    process.exit(1);
  }

  const userId = args[0];
  const role = args[1] as Role;
  const environment = args[2] as Environment;

  // Validate role
  if (!VALID_ROLES.includes(role)) {
    console.error(`❌ Error: Invalid role "${role}"`);
    console.error(`Valid roles: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }

  // Validate environment
  if (!ENVIRONMENTS[environment]) {
    console.error(`❌ Error: Invalid environment "${environment}"`);
    console.error('Valid environments: local, staging, production');
    process.exit(1);
  }

  try {
    const { auth, db } = initializeFirebase(environment);
    await setCustomClaims(auth, db, userId, role, environment);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
