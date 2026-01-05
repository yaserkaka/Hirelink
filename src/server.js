/**
 * Server entrypoint.
 *
 * Responsibilities:
 * - Starts the Express application (src/app.js) on the configured port.
 * - Keeps the entrypoint free of business logic (logic belongs in routes, controllers, and services).
 *
 * Notes:
 * - The project uses Node.js ES Modules (ESM).
 * - Runtime configuration is validated via Zod (src/config/env.js).
 *
 * References:
 * - Node.js ES Modules (ESM): https://nodejs.org/api/esm.html
 * - Express application API (listen): https://expressjs.com/en/5x/api.html#app.listen
 * - Node HTTP server, (what Express uses under the hood): https://nodejs.org/api/http.html#class-httpserver
 * - Zod (runtime schema validation): https://zod.dev/api
 */

import app from "./app.js";
import env from "./config/env.js";
import logger from "./lib/logger.js";

app.listen(env.PORT, () => {
	logger.info(`Server running on port ${env.PORT}`);
});
