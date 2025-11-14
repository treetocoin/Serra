#!/bin/bash
# Feature 004 Verification Script
# Verifies the development environment is properly set up for feature 004

set -e

echo "🔍 Verifying Feature 004: Simplified Device Onboarding"
echo "========================================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if on correct branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "004-tutto-troppo-complicato" ]; then
  echo -e "${RED}✗ Wrong branch: $CURRENT_BRANCH (expected: 004-tutto-troppo-complicato)${NC}"
  exit 1
fi
echo -e "${GREEN}✓ On correct branch: $CURRENT_BRANCH${NC}"

# Check if spec files exist
SPEC_DIR="specs/004-tutto-troppo-complicato"
REQUIRED_FILES=(
  "$SPEC_DIR/spec.md"
  "$SPEC_DIR/plan.md"
  "$SPEC_DIR/research.md"
  "$SPEC_DIR/data-model.md"
  "$SPEC_DIR/quickstart.md"
  "$SPEC_DIR/tasks.md"
  "$SPEC_DIR/contracts/rpc-functions.md"
  "$SPEC_DIR/contracts/edge-function-device-heartbeat.md"
  "$SPEC_DIR/contracts/frontend-api.md"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo -e "${RED}✗ Missing required file: $file${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Found: $file${NC}"
done

# Check if type definitions exist
TYPE_FILES=(
  "frontend/src/types/project.types.ts"
  "frontend/src/types/device.types.ts"
)

for file in "${TYPE_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo -e "${YELLOW}⚠ Type definition not yet created: $file${NC}"
  else
    echo -e "${GREEN}✓ Found: $file${NC}"
  fi
done

# Check npm dependencies
echo ""
echo "Checking npm dependencies..."
cd frontend
if ! npm list @supabase/supabase-js @tanstack/react-query react-router-dom >/dev/null 2>&1; then
  echo -e "${YELLOW}⚠ Some dependencies may need to be installed${NC}"
else
  echo -e "${GREEN}✓ Core dependencies installed${NC}"
fi
cd ..

echo ""
echo -e "${GREEN}✅ Feature 004 verification complete!${NC}"
