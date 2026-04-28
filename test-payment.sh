#!/bin/bash

echo "=== PHASE 7: M-PESA PAYMENT INTEGRATION TEST ==="
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

# Note: This will fail without real M-Pesa credentials, but shows the structure
echo "Step 3: Testing payment initiation (will fail without M-Pesa credentials)..."
curl -s -X POST http://localhost:5000/api/payments/mpesa/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"accountId\": \"$ACCOUNT_ID\",
    \"amount\": 1000,
    \"phoneNumber\": \"254712345678\"
  }" | python3 -m json.tool

echo ""
echo "Step 4: Getting payment history..."
curl -s -X GET http://localhost:5000/api/payments/history \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool

echo ""
echo "Note: Full M-Pesa integration requires Safaricom Daraja API credentials"
echo "Visit: https://developer.safaricom.co.ke to register"
