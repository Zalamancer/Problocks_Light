import app from './app.js';
import { logger } from './middleware/errors.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Problocks Light server started');
});
