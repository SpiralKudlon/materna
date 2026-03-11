import { Router, Request, Response } from 'express';
import pino from 'pino';
import { clickhouse } from '../lib/db';
import { generateCsv } from '../lib/generators/csv';
import { generatePdf } from '../lib/generators/pdf';
import { uploadAndPresign } from '../lib/s3';

const router = Router();
const logger = pino();

router.post('/export', async (req: Request, res: Response): Promise<any> => {
  try {
    const { format, startDate, endDate, tenantId } = req.body;

    if (!['csv', 'pdf'].includes(format)) {
      return res.status(400).json({ error: "Invalid format. Must be 'csv' or 'pdf'" });
    }

    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required" });
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days ago
    const end = endDate ? new Date(endDate) : new Date();

    // The fast < 200ms optimized query using MergeTree pre-aggregations
    const query = `
      SELECT
        toDate(updated_at) AS date,
        status,
        count(DISTINCT id) AS visit_count,
        sum(is_high_risk) AS high_risk_flags
      FROM (
        SELECT id, argMax(updated_at, updated_at) as updated_at, argMax(status, updated_at) as status, argMax(is_high_risk, updated_at) as is_high_risk, argMax(tenant_id, updated_at) as tenant_id
        FROM anc_visits
        WHERE tenant_id = {tenantId: UUID}
        GROUP BY id
      )
      WHERE updated_at >= {start: DateTime} AND updated_at <= {end: DateTime}
      GROUP BY date, status
      ORDER BY date DESC
    `;

    const sTime = performance.now();
    
    const rs = await clickhouse.query({
      query,
      query_params: {
        tenantId,
        start: Math.floor(start.getTime() / 1000),
        end: Math.floor(end.getTime() / 1000),
      },
      format: 'JSONEachRow'
    });

    const data: any[] = await rs.json();
    
    const elapsed = performance.now() - sTime;
    logger.info(`ClickHouse query executed in ${elapsed.toFixed(2)}ms`);

    if (elapsed > 200) {
      logger.warn(`SLA Breach: ClickHouse query took ${elapsed.toFixed(2)}ms (> 200ms SLA)`);
    }

    // Generate File
    let fileBuffer: Buffer;
    let contentType: string;
    let ext: string;

    if (format === 'csv') {
      fileBuffer = await generateCsv(data);
      contentType = 'text/csv';
      ext = 'csv';
    } else {
      fileBuffer = await generatePdf(data, `ANC Visits Report (${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]})`);
      contentType = 'application/pdf';
      ext = 'pdf';
    }

    // Upload & get URL
    const fileName = `exports/${tenantId}/anc_report_${Date.now()}.${ext}`;
    const url = await uploadAndPresign(fileBuffer, fileName, contentType);

    return res.status(200).json({
      message: "Export generated successfully",
      url,
      stats: {
        query_time_ms: parseInt(elapsed.toFixed(0)),
        rows_processed: data.length
      }
    });

  } catch (error: any) {
    logger.error({ err: error }, 'Export generation failed');
    return res.status(500).json({ error: "Failed to generate export", details: error.message });
  }
});

export default router;
