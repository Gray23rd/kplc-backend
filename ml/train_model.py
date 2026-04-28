#!/usr/bin/env python3
"""
UniPowerWallet ML Model Training
Trains a Random Forest model to predict electricity bills
Target: 85% accuracy
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import json
from datetime import datetime, timedelta

def generate_training_data(n_samples=1000):
    """
    Generate synthetic training data based on realistic patterns
    Features: historical kWh, appliance count, season, days, account type
    """
    np.random.seed(42)
    
    data = []
    for _ in range(n_samples):
        # Historical consumption (100-600 kWh range)
        prev_month_kwh = np.random.uniform(100, 600)
        prev_2_months_kwh = prev_month_kwh * np.random.uniform(0.8, 1.2)
        prev_3_months_kwh = prev_month_kwh * np.random.uniform(0.75, 1.25)
        
        # Appliance features
        num_appliances = np.random.randint(3, 15)
        has_ac = np.random.choice([0, 1], p=[0.6, 0.4])
        has_water_heater = np.random.choice([0, 1], p=[0.5, 0.5])
        
        # Seasonal factor (1=Jan, 12=Dec)
        month = np.random.randint(1, 13)
        # Hot months (Jan-Mar, Sep-Dec) use more electricity
        is_hot_season = 1 if month in [1, 2, 3, 9, 10, 11, 12] else 0
        
        # Days in month
        days_in_month = np.random.choice([28, 30, 31], p=[0.1, 0.4, 0.5])
        
        # Account type (0=Residential, 1=Commercial)
        account_type = np.random.choice([0, 1], p=[0.8, 0.2])
        
        # Calculate target kWh with realistic patterns
        base_kwh = (prev_month_kwh * 0.4 + 
                   prev_2_months_kwh * 0.3 + 
                   prev_3_months_kwh * 0.3)
        
        # Adjust for features
        seasonal_factor = 1.15 if is_hot_season else 1.0
        ac_factor = 1.3 if has_ac else 1.0
        heater_factor = 1.2 if has_water_heater else 1.0
        
        current_kwh = base_kwh * seasonal_factor * ac_factor * heater_factor
        current_kwh *= np.random.uniform(0.9, 1.1)  # Add noise
        
        # Calculate bill using KPLC tariff structure
        if account_type == 1:  # Commercial
            energy_charges = current_kwh * 18.5
            fixed_charge = 500
        else:  # Residential (tiered)
            if current_kwh <= 10:
                energy_charges = current_kwh * 12
            elif current_kwh <= 100:
                energy_charges = 10 * 12 + (current_kwh - 10) * 16
            elif current_kwh <= 1000:
                energy_charges = 10 * 12 + 90 * 16 + (current_kwh - 100) * 18
            else:
                energy_charges = 10 * 12 + 90 * 16 + 900 * 18 + (current_kwh - 1000) * 20
            fixed_charge = 150
        
        # Add levies and taxes
        fuel_cost = energy_charges * 0.13
        warma = energy_charges * 0.015
        subtotal = energy_charges + fixed_charge + fuel_cost + warma
        vat = subtotal * 0.16
        total_bill = subtotal + vat
        
        data.append({
            'prev_month_kwh': prev_month_kwh,
            'prev_2_months_kwh': prev_2_months_kwh,
            'prev_3_months_kwh': prev_3_months_kwh,
            'num_appliances': num_appliances,
            'has_ac': has_ac,
            'has_water_heater': has_water_heater,
            'month': month,
            'is_hot_season': is_hot_season,
            'days_in_month': days_in_month,
            'account_type': account_type,
            'current_kwh': current_kwh,
            'total_bill': total_bill
        })
    
    return pd.DataFrame(data)

def train_model():
    """Train Random Forest model for bill prediction"""
    print("Generating training data...")
    df = generate_training_data(n_samples=2000)
    
    # Features
    feature_cols = [
        'prev_month_kwh', 'prev_2_months_kwh', 'prev_3_months_kwh',
        'num_appliances', 'has_ac', 'has_water_heater',
        'month', 'is_hot_season', 'days_in_month', 'account_type'
    ]
    
    X = df[feature_cols]
    y_kwh = df['current_kwh']
    y_bill = df['total_bill']
    
    # Split data
    X_train, X_test, y_kwh_train, y_kwh_test, y_bill_train, y_bill_test = train_test_split(
        X, y_kwh, y_bill, test_size=0.2, random_state=42
    )
    
    # Train kWh prediction model
    print("\nTraining kWh prediction model...")
    kwh_model = RandomForestRegressor(
        n_estimators=100,
        max_depth=15,
        min_samples_split=5,
        random_state=42,
        n_jobs=-1
    )
    kwh_model.fit(X_train, y_kwh_train)
    
    # Train bill prediction model
    print("Training bill prediction model...")
    bill_model = RandomForestRegressor(
        n_estimators=100,
        max_depth=15,
        min_samples_split=5,
        random_state=42,
        n_jobs=-1
    )
    bill_model.fit(X_train, y_bill_train)
    
    # Evaluate models
    print("\n" + "="*50)
    print("MODEL EVALUATION")
    print("="*50)
    
    # kWh model
    kwh_pred = kwh_model.predict(X_test)
    kwh_mae = mean_absolute_error(y_kwh_test, kwh_pred)
    kwh_r2 = r2_score(y_kwh_test, kwh_pred)
    kwh_accuracy = 100 * (1 - kwh_mae / y_kwh_test.mean())
    
    print(f"\nkWh Prediction Model:")
    print(f"  Mean Absolute Error: {kwh_mae:.2f} kWh")
    print(f"  R² Score: {kwh_r2:.4f}")
    print(f"  Accuracy: {kwh_accuracy:.2f}%")
    
    # Bill model
    bill_pred = bill_model.predict(X_test)
    bill_mae = mean_absolute_error(y_bill_test, bill_pred)
    bill_r2 = r2_score(y_bill_test, bill_pred)
    bill_accuracy = 100 * (1 - bill_mae / y_bill_test.mean())
    
    print(f"\nBill Prediction Model:")
    print(f"  Mean Absolute Error: KSh {bill_mae:.2f}")
    print(f"  R² Score: {bill_r2:.4f}")
    print(f"  Accuracy: {bill_accuracy:.2f}%")
    
    # Feature importance
    print(f"\nTop 5 Most Important Features:")
    importances = bill_model.feature_importances_
    indices = np.argsort(importances)[::-1][:5]
    for i, idx in enumerate(indices, 1):
        print(f"  {i}. {feature_cols[idx]}: {importances[idx]:.4f}")
    
    # Save models
    print(f"\nSaving models...")
    joblib.dump(kwh_model, 'kwh_model.pkl')
    joblib.dump(bill_model, 'bill_model.pkl')
    
    # Save metadata
    metadata = {
        'trained_at': datetime.now().isoformat(),
        'n_samples': len(df),
        'features': feature_cols,
        'kwh_accuracy': float(kwh_accuracy),
        'bill_accuracy': float(bill_accuracy),
        'kwh_mae': float(kwh_mae),
        'bill_mae': float(bill_mae),
        'kwh_r2': float(kwh_r2),
        'bill_r2': float(bill_r2)
    }
    
    with open('model_metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print("\n✅ Models saved successfully!")
    print(f"   - kwh_model.pkl")
    print(f"   - bill_model.pkl")
    print(f"   - model_metadata.json")
    
    target_met = "✅ YES" if bill_accuracy >= 85 else "❌ NO"
    print(f"\n🎯 Target Accuracy (85%): {target_met}")
    
    return kwh_model, bill_model, metadata

if __name__ == "__main__":
    print("="*50)
    print("UniPowerWallet ML Model Training")
    print("="*50)
    train_model()
