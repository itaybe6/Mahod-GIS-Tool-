import { describe, expect, it } from 'vitest';
import {
  formatNumber,
  formatPercent,
  getTopLandUseInsight,
  makeAgeChartData,
  makeVehicleChartData,
  safePercent,
  toneForPercentile,
} from './calculations';
import type { DemographicsByCity, LandUseStat } from './types';

describe('statistics calculations', () => {
  it('formats Hebrew numbers and percentages', () => {
    expect(formatNumber(2847)).toBe('2,847');
    expect(formatPercent(12.345)).toBe('12.35%');
    expect(formatNumber(null)).toBe('—');
  });

  it('guards percentage division by zero', () => {
    expect(safePercent(5, 20)).toBe(25);
    expect(safePercent(5, 0)).toBe(0);
  });

  it('maps percentile thresholds to severity tones', () => {
    expect(toneForPercentile(10)).toBe('red');
    expect(toneForPercentile(25)).toBe('orange');
    expect(toneForPercentile(50)).toBe('yellow');
    expect(toneForPercentile(51)).toBe('green');
  });

  it('creates chart data from demographic rows', () => {
    const row: DemographicsByCity = {
      city: 'כל הארץ',
      inj0_19: 10,
      inj20_64: 20,
      inj65_: 5,
      injtotal: 35,
      private_vehicle: 40,
      motorcycle: 8,
      truck: 2,
      bicycle: 1,
      pedestrian: 6,
    };

    expect(makeAgeChartData(row).map((item) => item.value)).toEqual([10, 20, 5]);
    expect(makeVehicleChartData(row).map((item) => item.value)).toEqual([40, 8, 2, 1, 6]);
  });

  it('surfaces top land-use intensity insight', () => {
    const rows: LandUseStat[] = [
      {
        mainuse: 'מגורים',
        total_accidents: 100,
        area_sqm: 1000,
        intensity_per_sqkm: 100000,
        intensity_vs_average: 1.5,
      },
      {
        mainuse: 'מסחרי',
        total_accidents: 80,
        area_sqm: 100,
        intensity_per_sqkm: 800000,
        intensity_vs_average: 3.2,
      },
    ];

    expect(getTopLandUseInsight(rows)).toContain('מסחרי');
    expect(getTopLandUseInsight(rows)).toContain('פי 3.2');
  });
});
