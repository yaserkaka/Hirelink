/**
 * Authentication controller.
 *
 * Defines route handlers for registration, verification, login, refresh, logout,
 * and password reset.
 *
 * Controller layer responsibilities:
 * - Only handles HTTP: read the request, call the service, and return a standard response.
 * - Must not contain business rules (they belong in the service layer).
 *
 * Security notes:
 * - Access tokens are returned in JSON.
 * - Refresh tokens are set as HttpOnly cookies (see src/config/refreshCookie.js).
 *
 * References:
 * - OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
 * - Express routing: https://expressjs.com/en/guide/routing.html
 * - Express Request API: https://expressjs.com/en/5x/api.html#req
 * - Express Response API: https://expressjs.com/en/5x/api.html#res
 */

import { refreshCookie } from "../config/refreshCookie.js";
import { authService } from "../services/index.js";
import { fail, success } from "../utils/response.utils.js";
import statusCodes from "../utils/statusCodes.utils.js";

/**
 * Registers a new user (Talent or Employer) and triggers email verification.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function register(req, res) {
	const payload = req.validated ?? req.body;
	const result = await authService.register(payload);

	if (!result.ok) {
		return fail({
			res,
			statusCode: result.statusCode,
			message: result.message,
			details: result.payload,
		});
	}

	return success({
		res,
		statusCode: result.statusCode,
		message: result.message,
		data: result.payload,
	});
}

/**
 * Verifies a user's email using the verification token.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function verifyEmail(req, res) {
	const payload = req.validated ?? req.body;
	const result = await authService.verifyEmail(payload);

	if (!result.ok) {
		return fail({
			res,
			statusCode: result.statusCode,
			message: result.message,
			details: result.payload,
		});
	}

	return success({
		res,
		statusCode: result.statusCode,
		message: result.message,
		data: result.payload,
	});
}

/**
 * Logs a user in.
 *
 * Sets a refresh token as an HttpOnly cookie and returns an access token.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function login(req, res) {
	const payload = req.validated ?? req.body;
	const { email, password } = payload;

	const result = await authService.login(email, password);

	if (!result.ok) {
		return fail({
			res,
			statusCode: result.statusCode,
			message: result.message,
		});
	}

	if (result.payload.requiresVerification) {
		return success({
			res,
			statusCode: result.statusCode,
			message: result.message,
			data: result.payload,
		});
	}

	// Set the refresh token cookie
	res.cookie("jwt", result.payload.refreshToken, refreshCookie);
	return success({
		res,
		statusCode: statusCodes.OK,
		message: result.message,
		data: {
			token: result.payload.token,
		},
	});
}

/**
 * Rotates the refresh token (from HttpOnly cookie) and returns a new access token.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function refresh(req, res) {
	const { jwt: refreshToken } = req.cookies;
	const result = await authService.refresh(refreshToken);

	if (!result.ok) {
		return fail({
			res,
			statusCode: result.statusCode,
			message: result.message,
			details: result.payload,
		});
	}

	// Set the refresh token cookie
	res.cookie("jwt", result.payload.refreshToken, refreshCookie);
	return success({
		res,
		statusCode: result.statusCode,
		message: result.message,
		data: {
			token: result.payload.token,
		},
	});
}

/**
 * Returns the currently authenticated user.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function getCurrent(req, res) {
	const result = await authService.getCurrent(req.user.id);

	if (!result.ok) {
		return fail({
			res,
			statusCode: result.statusCode,
			message: result.message,
			details: result.payload,
		});
	}

	return success({
		res,
		statusCode: result.statusCode,
		message: result.message,
		data: result.payload,
	});
}

/**
 * Initiates a password reset flow by emailing a reset token.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function requestPasswordReset(req, res) {
	const payload = req.validated ?? req.body;
	const result = await authService.requestPasswordReset(payload.email);

	if (!result.ok) {
		return fail({
			res,
			statusCode: result.statusCode,
			message: result.message,
		});
	}

	return success({
		res,
		statusCode: result.statusCode,
		message: result.message,
		data: result.payload ?? null,
	});
}

/**
 * Resets a password using a reset token.
 *
 * Clears the refresh cookie after a successful reset.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function resetPassword(req, res) {
	const payload = req.validated ?? req.body;
	const result = await authService.resetPassword(payload);

	if (!result.ok) {
		return fail({
			res,
			statusCode: result.statusCode,
			message: result.message,
		});
	}

	// Clear the refresh token cookie after password reset
	res.clearCookie("jwt", refreshCookie);
	return success({
		res,
		statusCode: result.statusCode,
		message: result.message,
	});
}

/**
 * Logs out the current session by revoking the refresh token and clearing the cookie.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function logout(req, res) {
	const { jwt: refreshToken } = req.cookies;

	const result = await authService.logout(refreshToken);

	// Always clear the cookie, even if token revocation failed
	res.clearCookie("jwt", refreshCookie);

	if (!result.ok) {
		return fail({
			res,
			statusCode: result.statusCode,
			message: result.message,
		});
	}

	return success({
		res,
		statusCode: result.statusCode,
		message: result.message,
	});
}

/**
 * Logs out all devices by revoking all refresh tokens for the authenticated user.
 * Clears the cookie for the current device.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function logoutAllDevices(req, res) {
	const result = await authService.logoutAllDevices(req.user.id);

	// Clear the cookie for current device
	res.clearCookie("jwt", refreshCookie);

	if (!result.ok) {
		return fail({
			res,
			statusCode: result.statusCode,
			message: result.message,
		});
	}

	return success({
		res,
		statusCode: result.statusCode,
		message: result.message,
	});
}
