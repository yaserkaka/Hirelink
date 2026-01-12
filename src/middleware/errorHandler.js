/**
 * Global Express error handler.
 *
 * Normalizes thrown errors into the standard API response shape and logs
 * server and client errors appropriately.
 *
 * Operational notes:
 * - Treat 5xx as server faults (log full error).
 * - Treat 4xx as client faults (log the message at warn level).
 * - Avoid leaking internal stack traces to clients.
 *
 * References:
 * - Express error handling: https://expressjs.com/en/guide/error-handling.html
 */

import ApiError from "../errors/ApiError.js";
import logger from "../lib/logger.js";
import { fail } from "../utils/response.utils.js";

/**
 * Express error-handling middleware.
 * @param {unknown} err
 * @param {import("express").Request} _req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} _next
 */
function errorHandler(err, _req, res, _next) {
	const statusCode = err.statusCode || 500;

	if (statusCode >= 500) {
		logger.error(err);
	} else {
		logger.warn(err.message);
	}

	if (err instanceof ApiError) {
		return fail({
			res,
			statusCode: err.statusCode,
			message: err.message,
			details: err.details || null,
		});
	}

	return fail({
		res,
		statusCode: 500,
		message: "internal server error",
		details: null,
	});
}

export default errorHandler;
