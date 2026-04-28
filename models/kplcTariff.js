// backend/models/kplcTariff.js
// KPLC Tariff Structure (2024 rates)

/**
 * KPLC Tariff Calculator
 * Based on Kenya Power residential and commercial tariffs
 */

// Residential tariff tiers (LifeLine, Domestic, Small Commercial)
export const RESIDENTIAL_TARIFF = {
  lifeline: {
    name: 'Lifeline (0-10 kWh)',
    minKwh: 0,
    maxKwh: 10,
    ratePerKwh: 12.0
  },
  domestic1: {
    name: 'Domestic (11-100 kWh)',
    minKwh: 11,
    maxKwh: 100,
    ratePerKwh: 16.0
  },
  domestic2: {
    name: 'Domestic (101-1000 kWh)',
    minKwh: 101,
    maxKwh: 1000,
    ratePerKwh: 18.0
  },
  domestic3: {
    name: 'Domestic (1001+ kWh)',
    minKwh: 1001,
    maxKwh: Infinity,
    ratePerKwh: 20.0
  }
};

// Commercial tariff
export const COMMERCIAL_TARIFF = {
  rate: 18.5 // Fixed rate for commercial
};

// Fixed charges
export const FIXED_CHARGES = {
  residential: 150,
  commercial: 500
};

// Levies and taxes (as percentages)
export const LEVIES = {
  fuelCost: 0.13,        // 13% fuel cost adjustment
  warma: 0.015,          // 1.5% WARMA levy
  vat: 0.16              // 16% VAT
};

/**
 * Calculate energy charges based on consumption and type
 */
export const calculateEnergyCharges = (kwh, accountType = 'Residential') => {
  if (accountType === 'Commercial') {
    return kwh * COMMERCIAL_TARIFF.rate;
  }

  // Residential tiered calculation
  let totalCost = 0;
  let remainingKwh = kwh;

  const tiers = Object.values(RESIDENTIAL_TARIFF);
  
  for (const tier of tiers) {
    if (remainingKwh <= 0) break;

    const tierRange = tier.maxKwh - tier.minKwh + 1;
    const kwhInThisTier = Math.min(remainingKwh, tierRange);
    
    totalCost += kwhInThisTier * tier.ratePerKwh;
    remainingKwh -= kwhInThisTier;
  }

  return totalCost;
};

/**
 * Calculate full bill breakdown
 */
export const calculateBillBreakdown = (kwh, accountType = 'Residential') => {
  // Energy charges
  const energyCharges = calculateEnergyCharges(kwh, accountType);

  // Fixed charge
  const fixedCharge = accountType === 'Commercial' 
    ? FIXED_CHARGES.commercial 
    : FIXED_CHARGES.residential;

  // Fuel cost adjustment
  const fuelCost = energyCharges * LEVIES.fuelCost;

  // WARMA levy
  const warma = energyCharges * LEVIES.warma;

  // Subtotal before VAT
  const subtotal = energyCharges + fixedCharge + fuelCost + warma;

  // VAT
  const vat = subtotal * LEVIES.vat;

  // Total
  const total = Math.round(subtotal + vat);

  return {
    consumed: kwh,
    energyCharges: Math.round(energyCharges),
    fixedCharge,
    fuelCost: Math.round(fuelCost),
    warma: Math.round(warma),
    vat: Math.round(vat),
    total
  };
};

/**
 * Get tariff breakdown for display
 */
export const getTariffInfo = (accountType = 'Residential') => {
  if (accountType === 'Commercial') {
    return {
      type: 'Commercial',
      rate: COMMERCIAL_TARIFF.rate,
      fixedCharge: FIXED_CHARGES.commercial
    };
  }

  return {
    type: 'Residential',
    tiers: RESIDENTIAL_TARIFF,
    fixedCharge: FIXED_CHARGES.residential
  };
};
