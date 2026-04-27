import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { discoverRouter } from './routes/discover.js';
import { researchRouter } from './routes/research.js';
import { outreachRouter } from './routes/outreach.js';
import { pipelineRouter } from './routes/pipeline.js';
import { initDatabase, purgeStaleCache } from './lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/discover', discoverRouter);
app.use('/api/research', researchRouter);
app.use('/api/outreach', outreachRouter);
app.use('/api/pipeline', pipelineRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

// Serve static React app in production
const clientDist = path.resolve(__dirname, '../dist/client');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

async function start() {
  // Initialize DB (creates + seeds if first run)
  await initDatabase();
  purgeStaleCache();

  app.listen(PORT, () => {
    console.log(`BDR Copilot server running on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
