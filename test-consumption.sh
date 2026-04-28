#!/bin/bash

echo "=== PHASE 3: CONSUMPTION CALCULATION TEST ==="
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

# Add appliances
echo "Step 3: Adding appliances..."
curl -s -X POST "http://localhost:5000/api/consumption/appliances/$ACCOUNT_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "appliances": [
      {"name": "Refrigerator", "wattage": 150, "cycleFactor": 0.33, "hoursPerDay": 24, "quantity": 1},
      {"name": "TV", "wattage": 100, "hoursPerDay": 5, "quantity": 1},
      {"name": "LED Bulbs", "wattage": 10, "hoursPerDay": 6, "quantity": 10},
      {"name": "Water Heater", "wattage": 7000, "hoursPerDay": 1, "quantity": 1},
      {"name": "Air Conditioner", "wattage": 1500, "cycleFactor": 0.6, "hoursPerDay": 8, "quantity": 1}
    ]
  }' | python3 -m json.tool

echo ""
echo "Step 4: Calculate consumption and bill..."
curl -s -X POST "http://localhost:5000/api/consumption/calculate/$ACCOUNT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool
