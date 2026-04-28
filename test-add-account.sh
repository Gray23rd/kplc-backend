#!/bin/bash

echo "Step 1: Login..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}')

echo "$LOGIN_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('Token:', data['token'][:50] + '...')
print('User:', data['user']['email'])
"

TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

echo ""
echo "Step 2: Adding account..."
curl -s -X POST http://localhost:5000/api/accounts/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "accountNumber": "12345678901",
    "meterNumber": "987654321",
    "name": "Home - Nairobi",
    "type": "Residential",
    "address": "123 Nairobi Street"
  }' | python3 -m json.tool

echo ""#!/bin/bash

# Login and extract token using Python
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

echo "Adding account..."

# Add account
curl -X POST http://localhost:5000/api/accounts/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "accountNumber": "12345678901",
    "meterNumber": "987654321",
    "name": "Home - Nairobi",
    "type": "Residential",
    "address": "123 Nairobi Street"
  }'#!/bin/bash

# Login and get token
RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}')

# Extract token
TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "Token obtained: ${TOKEN:0:50}..."

# Add account
curl -X POST http://localhost:5000/api/accounts/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "accountNumber": "12345678901",
    "meterNumber": "987654321",
    "name": "Home - Nairobi",
    "type": "Residential",
    "address": "123 Nairobi Street"
  }'
