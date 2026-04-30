import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { discoverRouter } from './routes/discover.js';
import { researchRouter } from './routes/research.js';
import { outreachRouter } from './routes/outreach.js';
import { pipelineRouter } from './routes/pipeline.js';
import { settingsRouter } from './routes/settings.js';
import { homeRouter } from './routes/home.js';
import { batchRouter } from './routes/batch.js';
import { initDatabase, purgeStaleCache } from './lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API routes
app.use('/api/discover', discoverRouter);
app.use('/api/research', researchRouter);
app.use('/api/outreach', outreachRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/home', homeRouter);
app.use('/api/batch', batchRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

// Serve static React app in production
const clientDist = __dirname.includes('dist')
  ? path.resolve(__dirname, '../client')   // dist/server → dist/client
  : path.resolve(__dirname, '../dist/client'); // server → dist/client
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

export async function startServer(port?: number): Promise<number> {
  const usePort = port ?? Number(PORT);
  await initDatabase();
  purgeStaleCache();

  return new Promise((resolve, reject) => {
    const server = app.listen(usePort, () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : usePort;
      resolve(actualPort);
    });
    server.on('error', reject);
  });
}

// Always auto-start when this file is executed directly (including via fork)
startServer().then(port => {
  // eslint-disable-next-line no-console
  console.log(`BDR Copilot server running on http://localhost:${port}`);
}).catch(err => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});
