import { createClient } from '@clickhouse/client';
import pino from 'pino';

const logger = pino();

// Fallbacks for local testing with docker-compose cluster
export const clickhouse = createClient({
  host: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DB || 'default',
  request_timeout: 10000,
});

export async function checkClickHouseHealth() {
  try {
    const rs = await clickhouse.query({
      query: 'SELECT 1 AS ok',
      format: 'JSONEachRow'
    });
    return (await rs.json())[0].ok === 1;
  } catch (err) {
    logger.error({ err }, "ClickHouse connection failed");
    return false;
  }
}
