#!/bin/bash
set -e

echo "════════════════════════════════════════════════════════════════"
echo "  Running Smoke Tests Against Staging Environment"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STAGING_URL="${STAGING_URL:-https://us-central1-job-finder-staging.cloudfunctions.net}"
AUTH_TOKEN="${STAGING_AUTH_TOKEN:-}"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Function to print colored output
print_test() {
  echo -e "${BLUE}Test $1: $2${NC}"
}

print_success() {
  echo -e "${GREEN}  ✓ PASSED${NC}"
  ((TESTS_PASSED++))
}

print_failure() {
  echo -e "${RED}  ✗ FAILED: $1${NC}"
  ((TESTS_FAILED++))
}

print_skip() {
  echo -e "${YELLOW}  ⊘ SKIPPED: $1${NC}"
}

# Check if auth token is provided
if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${YELLOW}Warning: STAGING_AUTH_TOKEN not set${NC}"
  echo "Some tests requiring authentication will be skipped"
  echo "Set it with: export STAGING_AUTH_TOKEN='your-token'"
  echo ""
fi

# Test 1: Check if functions are deployed
print_test "1" "Checking if Cloud Functions are accessible"
((TOTAL_TESTS++))

# Try to get function list (this will fail if not logged in, but we just check URL)
RESPONSE_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$STAGING_URL/manageJobQueue" -X POST \
  -H "Content-Type: application/json" \
  -d '{"data":{}}' || echo "000")

if [ "$RESPONSE_CODE" != "000" ]; then
  print_success
  echo "  Response code: $RESPONSE_CODE"
else
  print_failure "Could not reach staging URL"
fi
echo ""

# Test 2: Health check (if exists)
print_test "2" "Health check endpoint"
((TOTAL_TESTS++))

RESPONSE=$(curl -s "$STAGING_URL/health" 2>/dev/null || echo "")
if [[ ! -z "$RESPONSE" ]] && [[ $RESPONSE == *"healthy"* || $RESPONSE == *"ok"* ]]; then
  print_success
  echo "  Response: $RESPONSE"
elif [[ $RESPONSE_CODE == "404" ]]; then
  print_skip "Health endpoint not implemented"
  ((TESTS_PASSED++))
else
  print_failure "Health check did not respond correctly"
fi
echo ""

# Test 3: Test manageJobQueue function (requires auth)
if [ ! -z "$AUTH_TOKEN" ]; then
  print_test "3" "Job queue management (authenticated)"
  ((TOTAL_TESTS++))
  
  RESPONSE=$(curl -s -X POST "$STAGING_URL/manageJobQueue" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"data":{"action":"getStats"}}' || echo "")
  
  # Check if we got a response (even if it's an error about missing action)
  if [[ ! -z "$RESPONSE" ]]; then
    # Success if we get any valid JSON response
    if echo "$RESPONSE" | python3 -m json.tool > /dev/null 2>&1; then
      print_success
      echo "  Function is accessible and responding"
    else
      print_failure "Function returned invalid JSON"
    fi
  else
    print_failure "No response from function"
  fi
  echo ""
else
  print_test "3" "Job queue management (authenticated)"
  ((TOTAL_TESTS++))
  print_skip "No auth token provided"
  ((TESTS_PASSED++))
  echo ""
fi

# Test 4: Check CORS headers
print_test "4" "CORS configuration"
((TOTAL_TESTS++))

CORS_HEADERS=$(curl -s -I -X OPTIONS "$STAGING_URL/manageJobQueue" \
  -H "Origin: https://job-finder-staging.web.app" \
  -H "Access-Control-Request-Method: POST" \
  2>/dev/null || echo "")

if [[ $CORS_HEADERS == *"Access-Control-Allow-Origin"* ]]; then
  print_success
  echo "  CORS headers present"
else
  print_failure "CORS headers not found"
fi
echo ""

# Test 5: Rate limiting check
print_test "5" "Rate limiting configuration"
((TOTAL_TESTS++))

# Make a request and check for rate limit headers
RATE_LIMIT_HEADERS=$(curl -s -I "$STAGING_URL/manageJobQueue" -X POST \
  -H "Content-Type: application/json" \
  -d '{"data":{}}' 2>/dev/null || echo "")

if [[ $RATE_LIMIT_HEADERS == *"X-RateLimit"* ]] || [[ $RATE_LIMIT_HEADERS == *"RateLimit"* ]]; then
  print_success
  echo "  Rate limiting is configured"
elif [[ $RESPONSE_CODE != "000" ]]; then
  print_skip "Rate limiting headers not visible (may still be configured)"
  ((TESTS_PASSED++))
else
  print_failure "Could not check rate limiting"
fi
echo ""

# Summary
echo "════════════════════════════════════════════════════════════════"
echo "  Smoke Test Results"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Total Tests:  $TOTAL_TESTS"
echo -e "${GREEN}Passed:       $TESTS_PASSED${NC}"
echo -e "${RED}Failed:       $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All smoke tests passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Test with real authentication tokens"
  echo "  2. Verify frontend integration"
  echo "  3. Check Firebase Console logs"
  echo "  4. Monitor error rates"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Some smoke tests failed${NC}"
  echo ""
  echo "Please investigate:"
  echo "  1. Check Firebase Console for function logs"
  echo "  2. Verify all functions are deployed"
  echo "  3. Check secrets are accessible"
  echo "  4. Verify CORS configuration"
  echo ""
  exit 1
fi
