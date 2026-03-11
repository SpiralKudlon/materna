import pino from 'pino';
import { clickhouse } from '../lib/db';

const logger = pino();

// DHIS2 configuration
const DHIS2_API_URL = process.env.DHIS2_API_URL || 'https://play.dhis2.org/demo/api';
const DHIS2_USERNAME = process.env.DHIS2_USERNAME || 'admin';
const DHIS2_PASSWORD = process.env.DHIS2_PASSWORD || 'district';

// DHIS2 Element mapping
const HIGH_RISK_INCIDENCE_ELEMENT_ID = 'highRiskIncidence001';

interface Dhis2DataValue {
  dataElement: string;
  period: string; // e.g. '202310' for Oct 2023
  orgUnit: string;
  value: string | number;
}

interface Dhis2Payload {
  dataValues: Dhis2DataValue[];
}

/**
 * Transforms Maternal-AI data into the Generic DHIS2 dataValueSets format
 */
export async function syncDhis2Indicators(tenantOrgUnitId: string, periodString: string) {
  try {
    // Determine bounds from period string (assuming YYYYMM format for simplicity)
    const year = parseInt(periodString.substring(0, 4));
    const month = parseInt(periodString.substring(4, 6)) - 1; // 0-indexed
    
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); // Last day of month

    // Query 1: High Risk Incidence Rate
    // Fast aggregate query ensuring < 200ms
    const q1 = `
      SELECT
        count(DISTINCT id) AS total_visits,
        sum(is_high_risk) AS high_risk_flags
      FROM (
        SELECT id, argMax(updated_at, updated_at) as updated_at, argMax(status, updated_at) as status, argMax(is_high_risk, updated_at) as is_high_risk, argMax(tenant_id, updated_at) as tenant_id
        FROM anc_visits
        WHERE tenant_id = {tenantId: UUID}
        GROUP BY id
      )
      WHERE updated_at >= {start: DateTime} AND updated_at <= {end: DateTime}
    `;

    const sTime = performance.now();
    const rs = await clickhouse.query({
      query: q1,
      query_params: {
        tenantId: tenantOrgUnitId, // Assuming 1:1 map in prototype
        start: Math.floor(startDate.getTime() / 1000),
        end: Math.floor(endDate.getTime() / 1000),
      },
      format: 'JSONEachRow'
    });

    const data: any[] = await rs.json();
    const elapsed = performance.now() - sTime;
    logger.info(`DHIS2 Aggregation executed in ${elapsed.toFixed(2)}ms`);

    const result = data[0];
    const totalVisits = Number(result.total_visits || 0);
    const highRiskFlags = Number(result.high_risk_flags || 0);
    
    const highRiskIncidenceRate = totalVisits > 0 
      ? (highRiskFlags / totalVisits) * 100 
      : 0;

    // Build the payload
    const payload: Dhis2Payload = {
      dataValues: [
        {
          dataElement: HIGH_RISK_INCIDENCE_ELEMENT_ID,
          period: periodString,
          orgUnit: tenantOrgUnitId,
          value: parseFloat(highRiskIncidenceRate.toFixed(2))
        }
      ]
    };

    logger.info({ payload }, "Prepared DHIS2 DataValueSet Payload");

    // In a production scenario, we would POST this to the DHIS2 API:
    // POST /api/dataValueSets
    /*
    const response = await fetch(`${DHIS2_API_URL}/dataValueSets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${DHIS2_USERNAME}:${DHIS2_PASSWORD}`).toString('base64')
      },
      body: JSON.stringify(payload)
    });
    */

    return payload;
  } catch (error) {
    logger.error({ err: error }, 'DHIS2 Sync Failed');
    throw error;
  }
}
