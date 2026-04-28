#!/bin/bash

echo "=== PHASE 6: FAMILY SHARING TEST ==="
echo ""

# Get token for primary user
echo "Step 1: Login as primary user..."
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

# Get account ID
echo "Step 2: Get account ID..."
ACCOUNT_ID=$(curl -s -X GET http://localhost:5000/api/accounts \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['accounts'][0]['id'] if data['accounts'] else '')")

echo "Account ID: $ACCOUNT_ID"
echo ""

# Invite family member
echo "Step 3: Inviting family member..."
INVITE_RESPONSE=$(curl -s -X POST http://localhost:5000/api/family/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"email\": \"family@example.com\",
    \"name\": \"Family Member\",
    \"role\": \"Member\",
    \"accountIds\": [\"$ACCOUNT_ID\"]
  }")

echo "$INVITE_RESPONSE" | python3 -m json.tool
echo ""

# Get family members
echo "Step 4: Getting family members list..."
curl -s -X GET "http://localhost:5000/api/family/members/$ACCOUNT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool

echo ""

# Get my invitations
echo "Step 5: Getting my invitations..."
curl -s -X GET http://localhost:5000/api/family/invitations \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool

echo ""
