/**
 * Request validation middleware.
 *
 * Validates `req.body` against a Zod schema and places the parsed payload on
 * `req.validated`. Throws API/validation errors for centralized handling.
 *
 * Notes:
 * - Keep schemas close to the domain (see `src/validators/*`).
 * - Only validated data should be used by controllers/services.
 *
 * References:
 * - Zod: https://zod.dev/
 */

import { z } from "zod";
import { ApiError, ValidationError } from "../errors/index.js";
import statusCodes from "../utils/statusCodes.utils.js";

/**
 * Builds a middleware to validate request bodies using a provided schema.
 * @param {import("zod").ZodTypeAny} schema
 * @returns {(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => Promise<void>}
 */
export default function validate(schema) {
	return async (req, _res, next) => {
		if (!req.body) {
			return next(new ApiError(statusCodes.BAD_REQUEST, "empty body"));
		}

		const result = schema.safeParse(req.body);
		if (result.success) {
			req.validated = result.data;
			return next();
		}

		const flattened = z.flattenError(result.error);
		return next(
			new ValidationError("validation error", {
				fieldErrors: flattened.fieldErrors,
				formErrors: flattened.formErrors,
			}),
		);
	};
}
