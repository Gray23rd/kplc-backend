#!/bin/bash

echo "=== PHASE 4: ML PREDICTION TEST ==="
echo ""

# Get token
echo "Step 1: Login..."
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

echo "Step 3: Getting bill prediction for next month..."
curl -s -X GET "http://localhost:5000/api/predictions/$ACCOUNT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool

echo ""
