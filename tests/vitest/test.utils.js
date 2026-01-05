/**
 * Vitest test helpers.
 *
 * References:
 * - Express Response API: https://expressjs.com/en/api.html#res
 */

import statusCode from "../../src/utils/statusCodes.utils.js";

export function createMockRes() {
	return {
		statusCode: statusCode.OK,
		body: null,
		status(code) {
			this.statusCode = code;
			return this;
		},
		json(payload) {
			this.body = payload;
			return this;
		},
	};
}
