/**
 * 404 handler.
 *
 * Responds with a standard API error response when no route matches.
 *
 * Notes:
 * - This must be mounted after all routes.
 * - It should not leak internal routing details.
 *
 * References:
 * - Express routing: https://expressjs.com/en/guide/routing.html
 */

import { fail } from "../utils/response.utils.js";

/**
 * Not-found middleware for Express.
 * @param {import("express").Request} _req
 * @param {import("express").Response} res
 */
export default function notFoundMiddleware(_req, res) {
	return fail({
		res,
		statusCode: 404,
		message: `route not found`,
		details: null,
	});
}
