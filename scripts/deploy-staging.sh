#!/bin/bash
set -e

echo "════════════════════════════════════════════════════════════════"
echo "  Starting Staging Deployment for Job Finder Backend"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
  echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

# Step 1: Pre-deployment checks
print_step "Step 1: Running pre-deployment checks..."
echo ""

print_step "Running linter..."
if npm run lint; then
  print_success "Linting passed"
else
  print_error "Linting failed"
  exit 1
fi
echo ""

print_step "Running tests..."
if npm test; then
  print_success "All tests passed"
else
  print_error "Tests failed"
  exit 1
fi
echo ""

print_step "Building production bundle..."
if npm run build; then
  print_success "Build succeeded"
else
  print_error "Build failed"
  exit 1
fi
echo ""

# Verify dist folder exists
if [ ! -d "functions/dist" ]; then
  print_error "dist/ folder not found after build"
  exit 1
fi
print_success "Build artifacts verified"
echo ""

# Step 2: Switch to staging project
print_step "Step 2: Switching to staging project..."
if firebase use staging; then
  print_success "Switched to staging project"
else
  print_error "Failed to switch to staging project"
  print_warning "Make sure 'staging' alias is configured in .firebaserc"
  exit 1
fi
echo ""

# Step 3: Deploy functions
print_step "Step 3: Deploying Cloud Functions..."
if firebase deploy --only functions --force; then
  print_success "Functions deployed successfully"
else
  print_error "Function deployment failed"
  exit 1
fi
echo ""

# Step 4: Deploy Firestore configuration
print_step "Step 4: Deploying Firestore rules and indexes..."
if firebase deploy --only firestore:rules,firestore:indexes; then
  print_success "Firestore configuration deployed"
else
  print_error "Firestore deployment failed"
  exit 1
fi
echo ""

# Step 5: Deploy Storage rules
print_step "Step 5: Deploying Storage rules..."
if firebase deploy --only storage; then
  print_success "Storage rules deployed"
else
  print_error "Storage deployment failed"
  exit 1
fi
echo ""

# Step 6: Verify deployment
print_step "Step 6: Verifying deployment..."
echo ""
print_step "Listing deployed functions..."
firebase functions:list
echo ""

# Step 7: Display next steps
echo ""
echo "════════════════════════════════════════════════════════════════"
print_success "Staging Deployment Complete!"
echo "════════════════════════════════════════════════════════════════"
echo ""
print_step "Next Steps:"
echo "  1. Run smoke tests: ./scripts/smoke-tests.sh"
echo "  2. Check logs: firebase functions:log"
echo "  3. Monitor in Firebase Console"
echo "  4. Test frontend integration"
echo ""
print_warning "Important:"
echo "  - Monitor logs for the next hour"
echo "  - Verify all critical user workflows"
echo "  - Check secrets are accessible"
echo ""
echo "Rollback command if needed:"
echo "  firebase deploy --only functions:<functionName> --force"
echo ""
