import request from 'supertest';
import express from 'express';
import analyticsRouter from '../../src/routes/analytics';

// Mock dependencies
jest.mock('../../src/lib/db', () => ({
  clickhouse: {
    query: jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue([
        { date: '2026-03-01', status: 'COMPLETED', visit_count: 50, high_risk_flags: 5 },
        { date: '2026-03-02', status: 'NO_SHOW', visit_count: 10, high_risk_flags: 2 }
      ])
    })
  }
}));

jest.mock('../../src/lib/generators/csv', () => ({
  generateCsv: jest.fn().mockResolvedValue(Buffer.from('mock,csv,data'))
}));

jest.mock('../../src/lib/generators/pdf', () => ({
  generatePdf: jest.fn().mockResolvedValue(Buffer.from('mock pdf data'))
}));

jest.mock('../../src/lib/s3', () => ({
  uploadAndPresign: jest.fn().mockResolvedValue('https://mock-s3-bucket.s3.amazonaws.com/presigned-url')
}));

const app = express();
app.use(express.json());
app.use('/analytics', analyticsRouter);

describe('POST /analytics/export', () => {

  it('should return 400 if tenantId is missing', async () => {
    const res = await request(app)
      .post('/analytics/export')
      .send({ format: 'csv' });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tenantId is required/);
  });

  it('should return 400 if format is invalid', async () => {
    const res = await request(app)
      .post('/analytics/export')
      .send({ tenantId: 'tenant-123', format: 'excel' });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid format/);
  });

  it('should handle CSV export and return a S3 presigned URL', async () => {
    const res = await request(app)
      .post('/analytics/export')
      .send({ tenantId: 'tenant-123', format: 'csv' });
    
    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://mock-s3-bucket.s3.amazonaws.com/presigned-url');
    expect(res.body.stats.rows_processed).toBe(2);
  });

  it('should handle PDF export and return a S3 presigned URL', async () => {
    const res = await request(app)
      .post('/analytics/export')
      .send({ tenantId: 'tenant-123', format: 'pdf' });
    
    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://mock-s3-bucket.s3.amazonaws.com/presigned-url');
    expect(res.body.stats.rows_processed).toBe(2);
  });
});
