// backend/utils/recommendations.js
// Energy-saving recommendation engine

/**
 * Generate personalized energy-saving recommendations
 */
export const generateRecommendations = (consumptionData) => {
  const { applianceBreakdown, totalKwh, billBreakdown } = consumptionData;
  const recommendations = [];
  let totalPotentialSavings = 0;

  // Sort appliances by consumption
  const sortedAppliances = [...applianceBreakdown].sort((a, b) => b.kwh - a.kwh);

  // 1. Air Conditioner recommendations
  const ac = sortedAppliances.find(a => 
    a.name.toLowerCase().includes('air') || 
    a.name.toLowerCase().includes('ac') ||
    a.name.toLowerCase().includes('conditioner')
  );

  if (ac && ac.percentage > 30) {
    const savings = Math.round(ac.cost * 0.25); // 25% potential savings
    recommendations.push({
      id: 'ac-temp',
      category: 'High Priority',
      appliance: ac.name,
      title: 'Optimize Air Conditioner Temperature',
      description: `Your AC accounts for ${ac.percentage}% of your bill. Setting it to 24°C instead of 20°C can reduce consumption significantly.`,
      savings: `KSh ${savings.toLocaleString()}/month`,
      impact: 'High',
      difficulty: 'Easy',
      actions: [
        'Set thermostat to 24°C (optimal comfort and efficiency)',
        'Use ceiling fans to circulate cool air',
        'Close doors and windows when AC is running',
        'Clean or replace AC filters monthly'
      ]
    });
    totalPotentialSavings += savings;

    if (ac.hoursPerDay > 10) {
      const timerSavings = Math.round(ac.cost * 0.15);
      recommendations.push({
        id: 'ac-timer',
        category: 'Medium Priority',
        appliance: ac.name,
        title: 'Use AC Timer Function',
        description: `You're running AC ${ac.hoursPerDay} hours daily. Use a timer to turn it off when not needed.`,
        savings: `KSh ${timerSavings.toLocaleString()}/month`,
        impact: 'Medium',
        difficulty: 'Easy',
        actions: [
          'Set timer to turn off AC 2 hours after you sleep',
          'Turn off AC when leaving the room for >30 minutes',
          'Use programmable thermostat if available'
        ]
      });
      totalPotentialSavings += timerSavings;
    }
  }

  // 2. Water Heater recommendations
  const waterHeater = sortedAppliances.find(a => 
    a.name.toLowerCase().includes('water') && 
    a.name.toLowerCase().includes('heater')
  );

  if (waterHeater && waterHeater.percentage > 25) {
    const savings = Math.round(waterHeater.cost * 0.30); // 30% potential savings
    recommendations.push({
      id: 'heater-timer',
      category: 'High Priority',
      appliance: waterHeater.name,
      title: 'Install Timer for Water Heater',
      description: `Your water heater uses ${waterHeater.percentage}% of your electricity. Heat water only when needed.`,
      savings: `KSh ${savings.toLocaleString()}/month`,
      impact: 'High',
      difficulty: 'Medium',
      actions: [
        'Install a timer - heat water only 1 hour before bathing',
        'Lower thermostat to 50-55°C (adequate for most needs)',
        'Insulate your water heater tank',
        'Fix any leaky taps immediately'
      ]
    });
    totalPotentialSavings += savings;
  }

  // 3. Refrigerator recommendations
  const fridge = sortedAppliances.find(a => 
    a.name.toLowerCase().includes('fridge') || 
    a.name.toLowerCase().includes('refrigerator')
  );

  if (fridge) {
    const age = 7; // Assume average age
    if (age > 5) {
      const savings = Math.round(fridge.cost * 0.40); // 40% savings with new fridge
      recommendations.push({
        id: 'fridge-upgrade',
        category: 'Long-term Investment',
        appliance: fridge.name,
        title: 'Consider Energy-Efficient Refrigerator',
        description: 'Old refrigerators consume 2-3x more electricity than modern energy-efficient models.',
        savings: `KSh ${savings.toLocaleString()}/month`,
        impact: 'High',
        difficulty: 'High (Investment Required)',
        actions: [
          'Look for Energy Star certified refrigerators',
          'Choose inverter technology models',
          'Right-size: Don\'t buy larger than needed',
          'Payback period: Typically 2-3 years'
        ]
      });
      totalPotentialSavings += savings;
    }

    const maintenanceSavings = Math.round(fridge.cost * 0.10);
    recommendations.push({
      id: 'fridge-maintenance',
      category: 'Easy Wins',
      appliance: fridge.name,
      title: 'Optimize Refrigerator Efficiency',
      description: 'Simple maintenance can reduce fridge consumption by 10-15%.',
      savings: `KSh ${maintenanceSavings.toLocaleString()}/month`,
      impact: 'Low',
      difficulty: 'Easy',
      actions: [
        'Set temperature to 3-4°C (fridge) and -18°C (freezer)',
        'Clean condenser coils every 3 months',
        'Check door seals - replace if worn',
        'Keep fridge 3/4 full for optimal efficiency',
        'Don\'t place hot food directly in fridge'
      ]
    });
    totalPotentialSavings += maintenanceSavings;
  }

  // 4. Lighting recommendations
  const lighting = sortedAppliances.filter(a => 
    a.name.toLowerCase().includes('bulb') || 
    a.name.toLowerCase().includes('light')
  );

  if (lighting.length > 0) {
    const totalLightingCost = lighting.reduce((sum, l) => sum + l.cost, 0);
    const hasLED = lighting.some(l => l.name.toLowerCase().includes('led'));
    
    if (!hasLED || lighting.some(l => !l.name.toLowerCase().includes('led'))) {
      const savings = Math.round(totalLightingCost * 0.60); // 60% savings
      recommendations.push({
        id: 'led-upgrade',
        category: 'Easy Wins',
        appliance: 'Lighting',
        title: 'Switch to LED Bulbs',
        description: 'LED bulbs use 75% less energy than incandescent and last 25x longer.',
        savings: `KSh ${savings.toLocaleString()}/month`,
        impact: 'Medium',
        difficulty: 'Easy',
        actions: [
          'Replace all incandescent bulbs with LEDs',
          'Choose 10W LED = 60W incandescent brightness',
          'Cost: KSh 200-400 per LED bulb',
          'Payback: 2-3 months'
        ]
      });
      totalPotentialSavings += savings;
    }

    recommendations.push({
      id: 'lighting-habits',
      category: 'Easy Wins',
      appliance: 'Lighting',
      title: 'Improve Lighting Habits',
      description: 'Simple changes in how you use lights can save 15-20%.',
      savings: `KSh ${Math.round(totalLightingCost * 0.15).toLocaleString()}/month`,
      impact: 'Low',
      difficulty: 'Easy',
      actions: [
        'Turn off lights when leaving a room',
        'Use natural daylight during the day',
        'Install motion sensors in rarely used areas',
        'Use task lighting instead of overhead lights'
      ]
    });
    totalPotentialSavings += Math.round(totalLightingCost * 0.15);
  }

  // 5. General high consumption warnings
  if (totalKwh > 500) {
    recommendations.push({
      id: 'general-audit',
      category: 'General Advice',
      appliance: 'Overall Usage',
      title: 'Conduct Energy Audit',
      description: `Your monthly consumption of ${totalKwh} kWh is above average. An energy audit can identify hidden waste.`,
      savings: 'KSh 1,000-3,000/month',
      impact: 'High',
      difficulty: 'Medium',
      actions: [
        'Check for phantom loads (devices on standby)',
        'Unplug chargers when not in use',
        'Use power strips with switches',
        'Consider hiring a professional energy auditor'
      ]
    });
  }

  // 6. Peak hours recommendation
  recommendations.push({
    id: 'peak-hours',
    category: 'Behavioral Change',
    appliance: 'General',
    title: 'Avoid Peak Hours When Possible',
    description: 'While KPLC doesn\'t have time-of-use pricing yet, reducing peak demand helps grid stability.',
    savings: 'Future savings when time-of-use rates introduced',
    impact: 'Low',
    difficulty: 'Easy',
    actions: [
      'Run washing machines, dishwashers at night',
      'Charge devices overnight',
      'Iron clothes early morning or late evening',
      'Prepare for future time-of-use tariffs'
    ]
  });

  // Sort by impact and potential savings
  const priorityOrder = { 'High Priority': 1, 'Medium Priority': 2, 'Easy Wins': 3, 'Long-term Investment': 4, 'Behavioral Change': 5, 'General Advice': 6 };
  recommendations.sort((a, b) => {
    const priorityDiff = priorityOrder[a.category] - priorityOrder[b.category];
    if (priorityDiff !== 0) return priorityDiff;
    
    const getSavingsValue = (rec) => {
      const match = rec.savings.match(/KSh ([\d,]+)/);
      return match ? parseInt(match[1].replace(/,/g, '')) : 0;
    };
    return getSavingsValue(b) - getSavingsValue(a);
  });

  return {
    recommendations: recommendations.slice(0, 8), // Top 8 recommendations
    totalPotentialSavings: `KSh ${totalPotentialSavings.toLocaleString()}`,
    currentMonthlyBill: `KSh ${billBreakdown.total.toLocaleString()}`,
    potentialMonthlyBill: `KSh ${Math.max(0, billBreakdown.total - totalPotentialSavings).toLocaleString()}`,
    savingsPercentage: Math.round((totalPotentialSavings / billBreakdown.total) * 100)
  };
};

/**
 * Get seasonal recommendations
 */
export const getSeasonalRecommendations = (month) => {
  const hotMonths = [1, 2, 3, 9, 10, 11, 12]; // Jan-Mar, Sep-Dec
  const isHotSeason = hotMonths.includes(month);

  if (isHotSeason) {
    return [
      {
        season: 'Hot Season',
        tips: [
          'Use fans instead of AC when temperature is below 28°C',
          'Close curtains during hottest part of day',
          'Wear light clothing to reduce AC dependence',
          'Plant shade trees around your home (long-term)'
        ]
      }
    ];
  } else {
    return [
      {
        season: 'Cool Season',
        tips: [
          'Take advantage of natural ventilation',
          'Reduce water heater usage - ambient water is warmer',
          'Plan energy-intensive renovations during this period',
          'Service AC units before hot season returns'
        ]
      }
    ];
  }
};
