import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pino from 'pino';

// Connect to existing Pino logger setup or local default
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'reporting' });
});

import analyticsRouter from './routes/analytics';
app.use('/analytics', analyticsRouter);

const PORT = process.env.REPORTING_PORT || 3004;

app.listen(PORT, () => {
  logger.info(`Reporting service listening on port ${PORT}`);
});
