#!/usr/bin/env python3
"""
ML Prediction Service (Flask API)
Provides bill prediction endpoints for Node.js backend
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import json
import os

app = Flask(__name__)
CORS(app)

# Load models
try:
    kwh_model = joblib.load('kwh_model.pkl')
    bill_model = joblib.load('bill_model.pkl')
    
    with open('model_metadata.json', 'r') as f:
        metadata = json.load(f)
    
    print("✅ Models loaded successfully!")
    print(f"   Bill Accuracy: {metadata['bill_accuracy']:.2f}%")
except Exception as e:
    print(f"❌ Error loading models: {e}")
    print("   Please run train_model.py first!")
    kwh_model = None
    bill_model = None
    metadata = None

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'models_loaded': kwh_model is not None,
        'metadata': metadata
    })

@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict next month's consumption and bill
    
    Request body:
    {
        "prev_month_kwh": 350,
        "prev_2_months_kwh": 320,
        "prev_3_months_kwh": 380,
        "num_appliances": 8,
        "has_ac": 1,
        "has_water_heater": 1,
        "month": 3,
        "is_hot_season": 1,
        "days_in_month": 31,
        "account_type": 0
    }
    """
    if kwh_model is None or bill_model is None:
        return jsonify({
            'error': 'Models not loaded. Please train models first.'
        }), 500
    
    try:
        data = request.json
        
        # Validate required fields
        required_fields = [
            'prev_month_kwh', 'prev_2_months_kwh', 'prev_3_months_kwh',
            'num_appliances', 'has_ac', 'has_water_heater',
            'month', 'is_hot_season', 'days_in_month', 'account_type'
        ]
        
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Prepare features
        features = np.array([[
            data['prev_month_kwh'],
            data['prev_2_months_kwh'],
            data['prev_3_months_kwh'],
            data['num_appliances'],
            data['has_ac'],
            data['has_water_heater'],
            data['month'],
            data['is_hot_season'],
            data['days_in_month'],
            data['account_type']
        ]])
        
        # Make predictions
        predicted_kwh = float(kwh_model.predict(features)[0])
        predicted_bill = float(bill_model.predict(features)[0])
        
        # Calculate confidence interval (±15% for 85% accuracy)
        kwh_lower = predicted_kwh * 0.85
        kwh_upper = predicted_kwh * 1.15
        bill_lower = predicted_bill * 0.85
        bill_upper = predicted_bill * 1.15
        
        # Calculate change from previous month
        prev_kwh = data['prev_month_kwh']
        kwh_change = ((predicted_kwh - prev_kwh) / prev_kwh) * 100 if prev_kwh > 0 else 0
        
        return jsonify({
            'success': True,
            'prediction': {
                'predicted_kwh': round(predicted_kwh, 2),
                'predicted_bill': round(predicted_bill, 2),
                'kwh_range': {
                    'lower': round(kwh_lower, 2),
                    'upper': round(kwh_upper, 2)
                },
                'bill_range': {
                    'lower': round(bill_lower, 2),
                    'upper': round(bill_upper, 2)
                },
                'change_from_prev_month': f"{kwh_change:+.1f}%",
                'confidence': '85%',
                'factors': [
                    'Historical usage patterns',
                    'Seasonal temperature trends' if data['is_hot_season'] else 'Standard consumption period',
                    'Appliance configuration',
                    'Current consumption trends'
                ]
            },
            'model_info': {
                'accuracy': f"{metadata['bill_accuracy']:.2f}%",
                'trained_at': metadata['trained_at']
            }
        })
        
    except Exception as e:
        return jsonify({
            'error': 'Prediction failed',
            'details': str(e)
        }), 500

@app.route('/batch-predict', methods=['POST'])
def batch_predict():
    """Predict for multiple accounts"""
    if kwh_model is None or bill_model is None:
        return jsonify({
            'error': 'Models not loaded. Please train models first.'
        }), 500
    
    try:
        data = request.json
        accounts = data.get('accounts', [])
        
        if not accounts:
            return jsonify({'error': 'No accounts provided'}), 400
        
        predictions = []
        for account in accounts:
            # Prepare features
            features = np.array([[
                account['prev_month_kwh'],
                account['prev_2_months_kwh'],
                account['prev_3_months_kwh'],
                account['num_appliances'],
                account['has_ac'],
                account['has_water_heater'],
                account['month'],
                account['is_hot_season'],
                account['days_in_month'],
                account['account_type']
            ]])
            
            predicted_kwh = float(kwh_model.predict(features)[0])
            predicted_bill = float(bill_model.predict(features)[0])
            
            predictions.append({
                'account_id': account.get('account_id'),
                'predicted_kwh': round(predicted_kwh, 2),
                'predicted_bill': round(predicted_bill, 2)
            })
        
        return jsonify({
            'success': True,
            'predictions': predictions,
            'count': len(predictions)
        })
        
    except Exception as e:
        return jsonify({
            'error': 'Batch prediction failed',
            'details': str(e)
        }), 500

if __name__ == '__main__':
    print("="*50)
    print("UniPowerWallet ML Prediction Service")
    print("="*50)
    print(f"Running on: http://localhost:5001")
    print("="*50)
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5001)))
