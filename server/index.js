// Load .env before anything else
try { process.loadEnvFile('.env'); } catch {}

const { default: app } = await import('./app.js');
const { logger } = await import('./middleware/errors.js');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Problocks Light server started');
});
