/**
 * Authentication middleware.
 *
 * Verifies the access token from the `Authorization: Bearer <token>` header,
 * loads the user from the database, enforces the role↔profile invariant,
 * and populates `req.user`.
 *
 * Security notes:
 * - Access tokens are expected to be short-lived.
 * - Authorization is split from authentication: this middleware authenticates;
 *   `requireRole` handles authorization.
 * - This middleware also fails requests if the user record is misconfigured
 *   (for example, a TALENT without a talent profile, or a user with both profiles).
 *
 * References:
 * - RFC 6750 (Bearer Token Usage): https://datatracker.ietf.org/doc/html/rfc6750
 * - RFC 7519 (JWT): https://datatracker.ietf.org/doc/html/rfc7519
 */

import prisma from "../lib/prisma.js";
import { tokenService } from "../services/index.js";
import { fail } from "../utils/response.utils.js";
import statusCodes from "../utils/statusCodes.utils.js";

/**
 * Requires a valid access token and an active user.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export default async function requireAuth(req, res, next) {
	const authHeader = req.headers.authorization;
	if (!authHeader) {
		return fail({
			res,
			statusCode: statusCodes.UNAUTHORIZED,
			message: "authorization header missing",
		});
	}

	const [scheme, token] = authHeader.split(" ");

	if (scheme !== "Bearer" || !token) {
		return fail({
			res,
			statusCode: statusCodes.BAD_REQUEST,
			message: "invalid auth format",
		});
	}

	const payload = await tokenService.verifyAccessToken(token);
	if (!payload) {
		return fail({
			res,
			statusCode: statusCodes.UNAUTHORIZED,
			message: "invalid or expired token",
		});
	}

	const user = await prisma.user.findUnique({
		where: { id: payload.id },
		select: {
			id: true,
			role: true,
			isActive: true,
			talentProfile: { select: { id: true } },
			employerProfile: { select: { id: true } },
		},
	});

	if (!user) {
		return fail({
			res,
			statusCode: statusCodes.UNAUTHORIZED,
			message: "user not found",
		});
	}

	if (!user.isActive) {
		return fail({
			res,
			statusCode: statusCodes.FORBIDDEN,
			message: "account deactivated",
		});
	}

	if (user.role === "TALENT") {
		if (!user.talentProfile || user.employerProfile) {
			return fail({
				res,
				statusCode: statusCodes.FORBIDDEN,
				message: "account misconfigured",
			});
		}
	}

	if (user.role === "EMPLOYER") {
		if (!user.employerProfile || user.talentProfile) {
			return fail({
				res,
				statusCode: statusCodes.FORBIDDEN,
				message: "account misconfigured",
			});
		}
	}

	if (user.role === "MODERATOR") {
		if (user.talentProfile || user.employerProfile) {
			return fail({
				res,
				statusCode: statusCodes.FORBIDDEN,
				message: "account misconfigured",
			});
		}
	}

	req.user = { id: user.id, role: user.role };
	next();
}
