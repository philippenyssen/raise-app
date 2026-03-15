#!/bin/bash
# evaluate.sh — Read-only product fitness evaluation (our prepare.py equivalent)
# DO NOT MODIFY THIS FILE during improvement loops.
# This is the ground truth metric, like Karpathy's evaluate_bpb.
#
# Output: JSON with individual scores and a composite fitness score (0-100)
# Usage: ./scripts/evaluate.sh

set -uo pipefail
cd "$(dirname "$0")/.."

# --- 1. Build check (20 points) ---
BUILD_SCORE=0
BUILD_DETAIL="failed"
if rm -rf .next 2>/dev/null && npx next build > /tmp/raise-build.log 2>&1; then
  BUILD_SCORE=20
  BUILD_DETAIL="passed"
fi

# --- 2. TypeScript errors (15 points) ---
TS_ERRORS=0
TS_SCORE=0
if npx tsc --noEmit > /tmp/raise-tsc.log 2>&1; then
  TS_ERRORS=0
  TS_SCORE=15
else
  TS_ERRORS=$(grep -c "error TS" /tmp/raise-tsc.log 2>/dev/null)
  TS_ERRORS=${TS_ERRORS:-0}
  TS_SCORE=$(( 15 - (TS_ERRORS > 15 ? 15 : TS_ERRORS) ))
  if [ "$TS_SCORE" -lt 0 ]; then TS_SCORE=0; fi
fi

# --- 3. Design system violations (10 points) ---
DESIGN_VIOLATIONS=0

# CSS/style uppercase (not JS string operations) — look for textTransform or CSS uppercase
UV=$(grep -rn "textTransform.*uppercase\|text-transform.*uppercase" src/app/ --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
UV=${UV:-0}
DESIGN_VIOLATIONS=$((DESIGN_VIOLATIONS + UV))

# Tailwind color classes (should use CSS custom properties)
TC=$(grep -rn "text-green\|text-red\|text-yellow\|bg-green\|bg-red\|bg-yellow" src/app/ --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
TC=${TC:-0}
DESIGN_VIOLATIONS=$((DESIGN_VIOLATIONS + TC))

# Wrong font weights (only 300 and 400 allowed in this design system)
FW=$(grep -rn "font-semibold\|font-bold\|font-extrabold" src/app/ --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
FW=${FW:-0}
DESIGN_VIOLATIONS=$((DESIGN_VIOLATIONS + FW))

# fontWeight above 400 in inline styles
FWI=$(grep -rn "fontWeight.*[56789]00\|fontWeight: [56789]" src/app/ --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
FWI=${FWI:-0}
DESIGN_VIOLATIONS=$((DESIGN_VIOLATIONS + FWI))

DESIGN_SCORE=$(( 10 - (DESIGN_VIOLATIONS > 10 ? 10 : DESIGN_VIOLATIONS) ))
if [ "$DESIGN_SCORE" -lt 0 ]; then DESIGN_SCORE=0; fi

# --- 4. API route hardening (10 points) ---
TOTAL_POST_ROUTES=$(grep -rl "req.json()" src/app/api/ --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
TOTAL_POST_ROUTES=${TOTAL_POST_ROUTES:-0}
UNHARDENED=$(grep -rL "Invalid JSON" src/app/api/ --include="*.ts" 2>/dev/null | xargs grep -l "req.json()" 2>/dev/null | wc -l | tr -d ' ')
UNHARDENED=${UNHARDENED:-0}
if [ "$TOTAL_POST_ROUTES" -gt 0 ]; then
  HARDENING_PCT=$(( (TOTAL_POST_ROUTES - UNHARDENED) * 100 / TOTAL_POST_ROUTES ))
  API_SCORE=$(( HARDENING_PCT * 10 / 100 ))
else
  API_SCORE=10
fi

# --- 5. Code simplicity (15 points) ---
# Baseline for this app: ~65K lines. Score based on delta from baseline.
# Removing code while maintaining features = improvement.
TOTAL_LINES=$(find src/ \( -name "*.tsx" -o -name "*.ts" \) -print0 | xargs -0 wc -l 2>/dev/null | tail -1 | awk '{print $1}')
BASELINE_LINES=66000
if [ "$TOTAL_LINES" -le "$BASELINE_LINES" ]; then
  LINES_SAVED=$(( (BASELINE_LINES - TOTAL_LINES) / 500 ))
  CODE_SCORE=$(( 8 + (LINES_SAVED > 7 ? 7 : LINES_SAVED) ))
else
  LINES_ADDED=$(( (TOTAL_LINES - BASELINE_LINES) / 500 ))
  CODE_SCORE=$(( 8 - (LINES_ADDED > 8 ? 8 : LINES_ADDED) ))
fi
if [ "$CODE_SCORE" -gt 15 ]; then CODE_SCORE=15; fi
if [ "$CODE_SCORE" -lt 0 ]; then CODE_SCORE=0; fi

# --- 6. Error handling quality (10 points) ---
EMPTY_CATCHES=$(grep -rn "catch {}" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
EMPTY_CATCHES=${EMPTY_CATCHES:-0}
CATCH_SCORE=$(( 10 - (EMPTY_CATCHES > 20 ? 10 : EMPTY_CATCHES / 2) ))
if [ "$CATCH_SCORE" -lt 0 ]; then CATCH_SCORE=0; fi

# --- 7. Feature coverage (20 points) ---
PAGE_COUNT=$(find src/app -name "page.tsx" 2>/dev/null | wc -l | tr -d ' ')
API_COUNT=$(find src/app/api -name "route.ts" 2>/dev/null | wc -l | tr -d ' ')
COMPONENT_COUNT=$(find src/components -name "*.tsx" 2>/dev/null | wc -l | tr -d ' ')
FEATURE_SCORE=20
if [ "$PAGE_COUNT" -lt 10 ]; then FEATURE_SCORE=$((FEATURE_SCORE - 5)); fi
if [ "$API_COUNT" -lt 10 ]; then FEATURE_SCORE=$((FEATURE_SCORE - 5)); fi
if [ "$COMPONENT_COUNT" -lt 5 ]; then FEATURE_SCORE=$((FEATURE_SCORE - 5)); fi
if [ "$FEATURE_SCORE" -lt 0 ]; then FEATURE_SCORE=0; fi

# --- Composite score ---
TOTAL_SCORE=$((BUILD_SCORE + TS_SCORE + DESIGN_SCORE + API_SCORE + CODE_SCORE + CATCH_SCORE + FEATURE_SCORE))

# --- Output JSON ---
cat <<JSONEOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "commit": "$(git rev-parse --short HEAD)",
  "total_score": $TOTAL_SCORE,
  "breakdown": {
    "build": {"score": $BUILD_SCORE, "max": 20, "detail": "$BUILD_DETAIL"},
    "typescript": {"score": $TS_SCORE, "max": 15, "errors": $TS_ERRORS},
    "design_system": {"score": $DESIGN_SCORE, "max": 10, "violations": $DESIGN_VIOLATIONS},
    "api_hardening": {"score": $API_SCORE, "max": 10, "unhardened_routes": $UNHARDENED},
    "code_simplicity": {"score": $CODE_SCORE, "max": 15, "total_lines": $TOTAL_LINES, "baseline": $BASELINE_LINES},
    "error_handling": {"score": $CATCH_SCORE, "max": 10, "empty_catches": $EMPTY_CATCHES},
    "feature_coverage": {"score": $FEATURE_SCORE, "max": 20, "pages": $PAGE_COUNT, "apis": $API_COUNT, "components": $COMPONENT_COUNT}
  }
}
JSONEOF
