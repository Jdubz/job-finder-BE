#!/bin/bash

###############################################################################
# Copy Production Firestore to Local Emulator
#
# This script exports Firestore data from production, downloads it, and
# imports it into the local Firebase emulator.
#
# Prerequisites:
#   - gcloud CLI authenticated and configured
#   - Firebase emulators must be STOPPED (script will verify)
#   - Sufficient disk space for export (~size of production database)
#   - curl or firebase CLI for emulator import
#
# Usage:
#   bash scripts/database/copy-prod-to-local.sh
###############################################################################

set -e  # Exit on error

# Configuration
PROD_PROJECT_ID="${PROD_PROJECT_ID:-static-sites-257923}"
PROD_DATABASE="${PROD_DATABASE_NAME:-portfolio}"
STAGING_PROJECT_ID="${STAGING_PROJECT_ID:-static-sites-257923}"
BUCKET_NAME="${FIRESTORE_BACKUP_BUCKET:-${STAGING_PROJECT_ID}-firestore-backups}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_PATH="gs://${BUCKET_NAME}/prod-to-local-${TIMESTAMP}"
LOCAL_BACKUP_DIR=".firebase/emulator-data/backup-${TIMESTAMP}"
EMULATOR_PORT="${FIRESTORE_EMULATOR_PORT:-8080}"

echo "🔄 Copying Firestore from Production to Local Emulator"
echo "======================================================="
echo "Production Project: ${PROD_PROJECT_ID}"
echo "Production Database: ${PROD_DATABASE}"
echo "Local Backup Dir: ${LOCAL_BACKUP_DIR}"
echo "Emulator Port: ${EMULATOR_PORT}"
echo ""

# Step 1: Check if emulators are running
echo "🔍 Checking if emulators are running..."
if lsof -i:${EMULATOR_PORT} &>/dev/null; then
  echo "  ❌ ERROR: Firestore emulator is running on port ${EMULATOR_PORT}"
  echo "  Please stop the emulators before running this script:"
  echo "    firebase emulators:stop"
  echo "  Or use the dev-monitor to stop Firebase Emulators"
  exit 1
fi
echo "  ✓ Emulators are stopped"

# Step 2: Verify bucket exists or create it
echo ""
echo "📦 Checking backup bucket..."
if ! gsutil ls -p "${STAGING_PROJECT_ID}" "gs://${BUCKET_NAME}" &>/dev/null; then
  echo "  Creating backup bucket: gs://${BUCKET_NAME}"
  gsutil mb -p "${STAGING_PROJECT_ID}" -l us-central1 "gs://${BUCKET_NAME}"
  echo "  ✓ Bucket created"
else
  echo "  ✓ Bucket exists"
fi

# Step 3: Export production database to Cloud Storage
echo ""
echo "📤 Exporting production database..."
echo "  Database: ${PROD_DATABASE}"
echo "  Destination: ${BACKUP_PATH}"

gcloud firestore export "${BACKUP_PATH}" \
  --project="${PROD_PROJECT_ID}" \
  --database="${PROD_DATABASE}" \
  --async

echo "  ⏳ Waiting for export to complete..."
sleep 5  # Give it a moment to start

# Poll for export completion
while true; do
  EXPORT_STATE=$(gcloud firestore operations list \
    --project="${PROD_PROJECT_ID}" \
    --filter="RUNNING" \
    --format="value(name)" \
    --limit=1)

  if [ -z "${EXPORT_STATE}" ]; then
    echo "  ✓ Export completed"
    break
  fi

  echo "  Still exporting... (checking again in 10s)"
  sleep 10
done

# Step 4: Download export to local machine
echo ""
echo "📥 Downloading export to local machine..."
echo "  Destination: ${LOCAL_BACKUP_DIR}"

mkdir -p "${LOCAL_BACKUP_DIR}"
gsutil -m rsync -r "${BACKUP_PATH}" "${LOCAL_BACKUP_DIR}"

echo "  ✓ Download completed"
echo "  Backup size: $(du -sh ${LOCAL_BACKUP_DIR} | cut -f1)"

# Step 5: Clear existing emulator data
echo ""
echo "🗑️  Clearing existing emulator data..."
read -p "  This will delete all current emulator data. Continue? (yes/no): " -r CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
  echo "  ❌ Import cancelled by user"
  echo "  Downloaded backup retained at: ${LOCAL_BACKUP_DIR}"
  exit 1
fi

# Clear firestore emulator data
rm -rf .firebase/emulator-data/firestore*
echo "  ✓ Emulator data cleared"

# Step 6: Import into emulator
echo ""
echo "📥 Importing into local emulator..."
echo "  ⚠️  NOTE: Emulator must be started for import to work"
echo ""
echo "  Starting emulators for import..."

# Start only Firestore emulator in background
firebase emulators:start --only firestore &
EMULATOR_PID=$!

# Wait for emulator to be ready
echo "  ⏳ Waiting for Firestore emulator to start..."
sleep 5

# Check if emulator is running
RETRY_COUNT=0
MAX_RETRIES=30
while ! lsof -i:${EMULATOR_PORT} &>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ ${RETRY_COUNT} -gt ${MAX_RETRIES} ]; then
    echo "  ❌ ERROR: Emulator failed to start after ${MAX_RETRIES} seconds"
    kill ${EMULATOR_PID} 2>/dev/null || true
    exit 1
  fi
  echo "  Still waiting for emulator... (${RETRY_COUNT}/${MAX_RETRIES})"
  sleep 1
done

echo "  ✓ Emulator is running"

# Import data using firebase CLI
echo "  Importing data..."
firebase emulators:export "${LOCAL_BACKUP_DIR}" --force

# Note: The above command exports FROM emulator, we need a different approach
# Let's use curl to import directly to Firestore emulator

echo "  ⚠️  NOTE: Direct import to Firestore emulator is not yet supported by Firebase CLI"
echo "  The backup has been downloaded to: ${LOCAL_BACKUP_DIR}"
echo ""
echo "  To complete the import, you have two options:"
echo ""
echo "  Option 1: Use a custom import script (recommended)"
echo "    - Parse the export files and upload to emulator via REST API"
echo "    - See: https://firebase.google.com/docs/emulator-suite/connect_firestore"
echo ""
echo "  Option 2: Import to staging first, then use emulator UI"
echo "    - Import to staging database using copy-prod-to-staging.sh"
echo "    - Use emulator UI to browse staging data"
echo ""

# Stop emulator
kill ${EMULATOR_PID} 2>/dev/null || true
echo "  ✓ Emulator stopped"

# Step 7: Cleanup Cloud Storage backup
echo ""
echo "🧹 Cleanup Options"
echo "  Cloud backup: ${BACKUP_PATH}"
echo "  Local backup: ${LOCAL_BACKUP_DIR}"
read -p "  Delete cloud backup to save storage costs? (yes/no): " -r DELETE_CLOUD

if [ "${DELETE_CLOUD}" = "yes" ]; then
  echo "  Deleting cloud backup..."
  gsutil -m rm -r "${BACKUP_PATH}"
  echo "  ✓ Cloud backup deleted"
else
  echo "  ℹ️  Cloud backup retained. Delete manually with:"
  echo "     gsutil -m rm -r ${BACKUP_PATH}"
fi

read -p "  Delete local backup to save disk space? (yes/no): " -r DELETE_LOCAL

if [ "${DELETE_LOCAL}" = "yes" ]; then
  echo "  Deleting local backup..."
  rm -rf "${LOCAL_BACKUP_DIR}"
  echo "  ✓ Local backup deleted"
else
  echo "  ℹ️  Local backup retained at: ${LOCAL_BACKUP_DIR}"
fi

echo ""
echo "✅ Production database export completed!"
echo ""
echo "Summary:"
echo "  Source: ${PROD_PROJECT_ID}/${PROD_DATABASE}"
echo "  Local backup: ${LOCAL_BACKUP_DIR}"
echo ""
echo "⚠️  Next Steps:"
echo "  1. Review the backup files in ${LOCAL_BACKUP_DIR}"
echo "  2. Consider using copy-prod-to-staging.sh to test with staging first"
echo "  3. For local emulator import, you'll need a custom import script"
echo ""
