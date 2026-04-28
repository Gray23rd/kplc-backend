// backend/utils/consumptionCalc.js
// Appliance consumption calculation utilities

/**
 * Calculate kWh consumption for a single appliance
 * Formula: kWh = (Wattage × Cycle_Factor × Hours_Per_Day × Days × Quantity) / 1000
 */
export const calculateApplianceConsumption = (appliance) => {
  const {
    wattage,
    cycleFactor = 1,      // How often it runs (0-1)
    hoursPerDay,
    days = 30,            // Default to monthly
    quantity = 1
  } = appliance;

  const kwh = (wattage * cycleFactor * hoursPerDay * days * quantity) / 1000;
  return Math.round(kwh * 100) / 100; // Round to 2 decimal places
};

/**
 * Calculate total consumption from multiple appliances
 */
export const calculateTotalConsumption = (appliances) => {
  if (!appliances || appliances.length === 0) return 0;

  const total = appliances.reduce((sum, appliance) => {
    return sum + calculateApplianceConsumption(appliance);
  }, 0);

  return Math.round(total * 100) / 100;
};

/**
 * Calculate cost per appliance
 */
export const calculateApplianceCost = (appliance, ratePerKwh = 17) => {
  const kwh = calculateApplianceConsumption(appliance);
  return Math.round(kwh * ratePerKwh);
};

/**
 * Get appliance breakdown with costs
 */
export const getApplianceBreakdown = (appliances, ratePerKwh = 17) => {
  if (!appliances || appliances.length === 0) return [];

  return appliances.map(appliance => {
    const kwh = calculateApplianceConsumption(appliance);
    const cost = Math.round(kwh * ratePerKwh);
    
    return {
      name: appliance.name,
      wattage: appliance.wattage,
      hoursPerDay: appliance.hoursPerDay,
      quantity: appliance.quantity || 1,
      kwh,
      cost,
      percentage: 0 // Will be calculated after total is known
    };
  });
};

/**
 * Calculate percentage contribution of each appliance
 */
export const calculateAppliancePercentages = (applianceBreakdown) => {
  const totalKwh = applianceBreakdown.reduce((sum, app) => sum + app.kwh, 0);
  
  if (totalKwh === 0) return applianceBreakdown;

  return applianceBreakdown.map(app => ({
    ...app,
    percentage: Math.round((app.kwh / totalKwh) * 100)
  }));
};

/**
 * Common Kenyan household appliances with default values
 */
export const DEFAULT_APPLIANCES = {
  // Kitchen
  refrigerator: { name: 'Refrigerator', wattage: 150, cycleFactor: 0.33, hoursPerDay: 24 },
  microwave: { name: 'Microwave', wattage: 1200, cycleFactor: 1, hoursPerDay: 0.5 },
  electricKettle: { name: 'Electric Kettle', wattage: 2000, cycleFactor: 1, hoursPerDay: 0.5 },
  riceCooker: { name: 'Rice Cooker', wattage: 700, cycleFactor: 1, hoursPerDay: 1 },
  
  // Heating/Cooling
  airConditioner: { name: 'Air Conditioner', wattage: 1500, cycleFactor: 0.6, hoursPerDay: 8 },
  fan: { name: 'Fan', wattage: 75, cycleFactor: 1, hoursPerDay: 8 },
  waterHeater: { name: 'Water Heater (Instant)', wattage: 7000, cycleFactor: 1, hoursPerDay: 1 },
  
  // Lighting
  ledBulb: { name: 'LED Bulb (10W)', wattage: 10, cycleFactor: 1, hoursPerDay: 6 },
  cflBulb: { name: 'CFL Bulb (20W)', wattage: 20, cycleFactor: 1, hoursPerDay: 6 },
  incandescentBulb: { name: 'Incandescent Bulb (60W)', wattage: 60, cycleFactor: 1, hoursPerDay: 6 },
  
  // Electronics
  tv: { name: 'TV (LED)', wattage: 100, cycleFactor: 1, hoursPerDay: 5 },
  laptop: { name: 'Laptop', wattage: 65, cycleFactor: 1, hoursPerDay: 6 },
  desktop: { name: 'Desktop Computer', wattage: 200, cycleFactor: 1, hoursPerDay: 6 },
  phone: { name: 'Phone Charger', wattage: 5, cycleFactor: 1, hoursPerDay: 2 },
  
  // Laundry
  washingMachine: { name: 'Washing Machine', wattage: 500, cycleFactor: 1, hoursPerDay: 1 },
  iron: { name: 'Iron', wattage: 1200, cycleFactor: 1, hoursPerDay: 0.5 },
  
  // Other
  vacuumCleaner: { name: 'Vacuum Cleaner', wattage: 1400, cycleFactor: 1, hoursPerDay: 0.5 },
  securityLights: { name: 'Security/Outdoor Lights', wattage: 40, cycleFactor: 1, hoursPerDay: 12 }
};
