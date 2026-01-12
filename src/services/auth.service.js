/**
 * Authentication service.
 *
 * Handles authentication business logic:
 * - registration (asks the role services to create the right profile)
 * - email verification and resending the verification token
 * - login (creates access and refresh tokens)
 * - refresh token rotation (uses token.service)
 * - password reset flows
 * - logout and logout from all devices
 *
 * Notes:
 * - This service is the main place for auth business rules.
 * - Emails are sent in the background and errors are logged.
 *
 * References:
 * - OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
 * - OWASP Forgot Password Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
 */

import bcrypt from "bcrypt";
import env from "../config/env.js";
import ApiError from "../errors/ApiError.js";
import logger from "../lib/logger.js";
import prisma from "../lib/prisma.js";
import { parseExpiry } from "../utils/general.utils.js";
import { result } from "../utils/response.utils.js";
import statusCodes from "../utils/statusCodes.utils.js";
import * as emailService from "./email.service.js";
import * as employerService from "./employer.service.js";
import * as talentService from "./talent.service.js";
import * as tokenService from "./token.service.js";
import * as userService from "./user.service.js";
import * as verificationService from "./verification.service.js";

/**
 * Registers a new user and creates the associated role profile.
 * @param {{ email: string, password: string, role: "TALENT"|"EMPLOYER", profileData: object }} payload
 */
export async function register({ email, password, role, profileData }) {
	const hashed = await bcrypt.hash(password, 10);
	const profileOptions = { email, password: hashed, profileData };

	let result;
	switch (role) {
		case "TALENT":
			result = await talentService.createProfile(profileOptions);
			break;
		case "EMPLOYER":
			result = await employerService.createProfile(profileOptions);
			break;
		default:
			throw new ApiError(statusCodes.BAD_REQUEST, "Invalid role");
	}

	if (!result.ok) {
		return result;
	}

	const verificationUrl = `${env.FRONTEND_URL}/verify?vt=${result.payload.verificationToken}`;

	if (env.NODE_ENV !== "production") {
		logger.info(
			{ email: result.payload.email, verificationUrl },
			"[dev] verification url",
		);
	}

	emailService
		.sendVerificationEmail(result.payload.email, verificationUrl, {
			expiryMinutes: 5,
		})
		.catch((err) => {
			logger.error(err);
		});

	delete result.payload.password; // Remove password for security reasons
	if (env.NODE_ENV === "production") {
		delete result.payload.verificationToken;
		delete result.payload.verificationExpiresAt;
	}

	return result;
}

/**
 * Verifies a user's email using the verification token.
 * @param {{ verificationToken: string }} payload
 */
export async function verifyEmail({ verificationToken }) {
	const user = await prisma.user.findFirst({
		where: { verificationToken },
	});

	if (!user) {
		return result({
			ok: false,
			statusCode: statusCodes.BAD_REQUEST,
			message: "invalid or expired verification token",
		});
	}

	if (user.isEmailVerified) {
		await prisma.user.update({
			where: { id: user.id },
			data: {
				verificationToken: null,
				verificationExpiresAt: null,
			},
		});
		return result({
			ok: false,
			statusCode: statusCodes.BAD_REQUEST,
			message: "email already verified",
		});
	}

	if (!user.verificationExpiresAt || new Date() > user.verificationExpiresAt) {
		await prisma.user.update({
			where: { id: user.id },
			data: {
				verificationToken: null,
				verificationExpiresAt: null,
			},
		});
		return result({
			ok: false,
			statusCode: statusCodes.BAD_REQUEST,
			message: "verification token has expired",
			payload: null,
		});
	}

	const verifiedUser = await prisma.user.update({
		where: { id: user.id },
		data: {
			isEmailVerified: true,
			verificationToken: null,
			verificationExpiresAt: null,
		},
	});

	logger.debug(`User ${user.email} verified`);

	delete verifiedUser.password;
	return result({
		ok: true,
		statusCode: statusCodes.OK,
		message: "email verified",
		payload: verifiedUser,
	});
}

/**
 * Logs in a user.
 *
 * Returns an access token and a refresh token. The controller is responsible for
 * setting the refresh token cookie.
 * @param {string} email
 * @param {string} password
 */
export async function login(email, password) {
	const user = await userService.findUser(email);

	if (!user) {
		return result({
			ok: false,
			statusCode: statusCodes.UNAUTHORIZED,
			message: "invalid credentials",
		});
	}

	// --- Email not verified ---
	if (!user.isEmailVerified) {
		const verificationToken = await verificationService.resendVerificationToken(
			user.id,
		);

		const verificationUrl = `${env.FRONTEND_URL}/verify?vt=${verificationToken}`;

		if (env.NODE_ENV !== "production") {
			logger.info(
				{ email: user.email, verificationUrl },
				"[dev] verification url",
			);
		}

		emailService
			.sendVerificationEmail(user.email, verificationUrl, {
				expiryMinutes: 5,
			})
			.catch((err) => {
				logger.error(err);
			});

		return result({
			ok: true,
			statusCode: statusCodes.OK,
			message: "email verification required",
			payload: {
				requiresVerification: true,
				...(env.NODE_ENV !== "production" ? { verificationToken } : {}),
			},
		});
	}

	// --- Password check ---
	const isValidPassword = await bcrypt.compare(password, user.password);
	if (!isValidPassword) {
		return result({
			ok: false,
			statusCode: statusCodes.BAD_REQUEST,
			message: "invalid credentials",
		});
	}

	// --- Create tokens ---
	const accessToken = tokenService.generateAccessToken(user.id);
	const refreshToken = tokenService.generateRefreshToken(user.id);

	const refreshExpiryMs = parseExpiry(env.JWT_REFRESH_EXPIRY);

	await tokenService.store(
		refreshToken,
		user.id,
		new Date(Date.now() + refreshExpiryMs),
	);

	return result({
		ok: true,
		statusCode: statusCodes.OK,
		message: "user logged in",
		payload: {
			token: accessToken,
			refreshToken,
			refreshExpiryMs,
		},
	});
}

/**
 * Rotates the refresh token and returns a new access token.
 * @param {string} refreshToken
 */
export async function refresh(refreshToken) {
	const rotationResult = await tokenService.rotateRefreshToken(refreshToken);

	if (!rotationResult.ok) {
		return rotationResult;
	}

	// Create a new access token
	const accessToken = tokenService.generateAccessToken(
		rotationResult.payload.userId,
	);

	return {
		...rotationResult, // keep the same status code and message
		payload: {
			// add the new access token
			...rotationResult.payload,
			token: accessToken,
		},
	};
}

/**
 * Fetches the current user by id.
 *
 * If the user exists but is not email-verified, returns a success response with
 * `requiresVerification`.
 * @param {string} userId
 */
export async function getCurrent(userId) {
	const user = await userService.findUser(userId);

	if (!user) {
		return result({
			ok: false,
			statusCode: statusCodes.UNAUTHORIZED,
			message: "user not found",
		});
	}

	// --- Email not verified ---
	if (!user.isEmailVerified) {
		return result({
			ok: true,
			statusCode: statusCodes.OK,
			message: "email verification required",
			payload: {
				requiresVerification: true,
			},
		});
	}

	delete user.password;
	delete user.verificationToken;
	delete user.verificationExpiresAt;

	return result({
		ok: true,
		statusCode: statusCodes.OK,
		message: "user fetched",
		payload: user,
	});
}

/**
 * Requests a password reset email for the provided email.
 *
 * Always returns OK to avoid leaking which emails exist.
 * @param {string} email
 */
export async function requestPasswordReset(email) {
	const user = await userService.findUser(email);

	if (!user) {
		// Do not reveal whether the email exists: always return success
		return result({
			ok: true,
			statusCode: statusCodes.OK,
			message: "if an account exists, a password reset email has been sent",
		});
	}

	// Create reset token
	const resetToken = await verificationService.generatePasswordResetToken(
		user.id,
	);

	const resetUrl = `${env.FRONTEND_URL}/reset?vt=${resetToken}`;

	if (env.NODE_ENV !== "production") {
		logger.info({ email: user.email, resetUrl }, "[dev] password reset url");
	}

	// Send password reset email (non-blocking)
	emailService
		.sendPasswordResetEmail(user.email, resetUrl, {
			expiryMinutes: 5,
		})
		.catch((err) => {
			logger.error("Failed to send password reset email:", err);
		});

	return result({
		ok: true,
		statusCode: statusCodes.OK,
		message: "if an account exists, a password reset email has been sent",
		payload: env.NODE_ENV !== "production" ? { resetToken } : null,
	});
}

/**
 * Resets a password using a reset token.
 * @param {{ verificationToken: string, newPassword: string, oldPassword?: string }} payload
 */
export async function resetPassword({
	verificationToken,
	newPassword,
	oldPassword,
}) {
	// Find the user by the reset token
	const user = await prisma.user.findFirst({
		where: { verificationToken },
	});

	if (!user) {
		return result({
			ok: false,
			statusCode: statusCodes.BAD_REQUEST,
			message: "invalid or expired reset token",
		});
	}

	// Check if the token has expired
	if (!user.verificationExpiresAt || new Date() > user.verificationExpiresAt) {
		await prisma.user.update({
			where: { id: user.id },
			data: {
				verificationToken: null,
				verificationExpiresAt: null,
			},
		});
		return result({
			ok: false,
			statusCode: statusCodes.BAD_REQUEST,
			message: "reset token has expired",
		});
	}

	// If the email is already verified and oldPassword is provided, check it
	if (user.isEmailVerified && oldPassword) {
		const isValidPassword = await bcrypt.compare(oldPassword, user.password);
		if (!isValidPassword) {
			return result({
				ok: false,
				statusCode: statusCodes.BAD_REQUEST,
				message: "invalid old password",
			});
		}
	}

	// Hash the new password
	const hashedPassword = await bcrypt.hash(newPassword, 10);

	// Update the password and clear the reset token in one transaction
	// Also revoke all refresh tokens for security
	await prisma.$transaction(async (tx) => {
		await tx.user.update({
			where: { id: user.id },
			data: {
				password: hashedPassword,
				isEmailVerified: true, // Verify email if it was not verified yet
				verificationToken: null,
				verificationExpiresAt: null,
			},
		});

		// Revoke all active refresh tokens
		await tx.refreshToken.updateMany({
			where: { userId: user.id, revoked: false },
			data: {
				revoked: true,
				revokedAt: new Date(),
			},
		});
	});

	logger.info(`Password reset successful for user ${user.email}`);

	return result({
		ok: true,
		statusCode: statusCodes.OK,
		message: "password reset successful",
	});
}

/**
 * Logs out the current session by revoking the refresh token.
 * @param {string | undefined} refreshToken
 */
export async function logout(refreshToken) {
	if (!refreshToken) {
		return result({
			ok: false,
			statusCode: statusCodes.BAD_REQUEST,
			message: "no token provided",
		});
	}

	return await tokenService.revokeRefreshToken(refreshToken);
}

/**
 * Logs out all devices by revoking all refresh tokens for the user.
 * @param {string} userId
 */
export async function logoutAllDevices(userId) {
	try {
		await tokenService.revokeAllRefreshTokens(userId);

		return result({
			ok: true,
			statusCode: statusCodes.OK,
			message: "logged out from all devices",
		});
	} catch (error) {
		logger.error("Failed to logout all devices:", error);
		return result({
			ok: false,
			statusCode: statusCodes.INTERNAL_SERVER_ERROR,
			message: "logout failed",
		});
	}
}
