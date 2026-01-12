/**
 * Authentication routes.
 *
 * Defines endpoints for:
 * - registration and email verification
 * - login / logout
 * - refresh-token rotation
 * - password reset flows
 * - fetching the current authenticated user
 *
 * Notes:
 * - Most endpoints validate request bodies via Zod schemas.
 * - `/auth/me` requires a valid access token (see `requireAuth`).
 * - Refresh is handled via cookie-based refresh tokens (see token service + refresh cookie config).
 *
 * References:
 * - RFC 7519 (JWT): https://datatracker.ietf.org/doc/html/rfc7519
 * - OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
 */

import { Router } from "express";
import { authController } from "../controllers/index.js";
import requireAuth from "../middleware/requireAuth.js";
import validate from "../middleware/validate.js";
import {
	loginSchema,
	registerSchema,
	requestPasswordResetSchema,
	resetPasswordSchema,
	verifyEmailSchema,
} from "../validators/auth.validator.js";

const router = Router();

router.post("/register", validate(registerSchema), authController.register);
router.post("/verify", validate(verifyEmailSchema), authController.verifyEmail);
router.post("/login", validate(loginSchema), authController.login);
router.get("/refresh", authController.refresh);

router.post(
	"/reset/request",
	validate(requestPasswordResetSchema),
	authController.requestPasswordReset,
);
router.put(
	"/reset",
	validate(resetPasswordSchema),
	authController.resetPassword,
);

router.get("/me", requireAuth, authController.getCurrent);
router.post("/logout", authController.logout);
router.post("/logout/all", requireAuth, authController.logoutAllDevices);

export default router;
