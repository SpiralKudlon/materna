import { syncDhis2Indicators } from '../../src/workers/dhis2.worker';

// Mock clickhouse client
jest.mock('../../src/lib/db', () => ({
  clickhouse: {
    query: jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue([{
        total_visits: "500000",
        high_risk_flags: "25000"
      }])
    })
  }
}));

describe('DHIS2 Worker', () => {
  it('should map clickhouse analytics to DHIS2 Generic JSON format', async () => {
    
    // 25000 / 500000 = 0.05 = 5.00%
    const payload = await syncDhis2Indicators('kenya_org_01', '202603');
    
    expect(payload.dataValues).toBeDefined();
    expect(payload.dataValues.length).toBe(1);
    
    const indicator = payload.dataValues[0];
    expect(indicator.dataElement).toBe('highRiskIncidence001');
    expect(indicator.period).toBe('202603');
    expect(indicator.orgUnit).toBe('kenya_org_01');
    expect(indicator.value).toBe(5.00); // 5% expected
  });
});
