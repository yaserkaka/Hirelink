/**
 * Application logger.
 *
 * Exposes a configured Pino instance with pretty transport enabled in
 * non-production environments.
 *
 * Notes:
 * - `LOG_LEVEL` can be used to override default levels.
 * - In production, structured JSON logs are preferred for collection by logging systems.
 *
 * References:
 * - Pino: https://getpino.io/
 */

import pino from "pino";
import env from "../config/env.js";

const isProd = env.NODE_ENV === "production";

const logger = pino({
	level: env.LOG_LEVEL || (isProd ? "info" : "debug"),
	redact: {
		paths: [
			"req.headers.authorization",
			"req.headers.cookie",
			"res.headers.set-cookie",
			"headers.authorization",
			"headers.cookie",
			"authorization",
			"cookie",
			"password",
			"refreshToken",
			"accessToken",
			"verificationToken",
			"verificationUrl",
			"resetUrl",
			"passwordResetUrl",
		],
		censor: "[REDACTED]",
	},
	serializers: {
		err: pino.stdSerializers.err,
	},
	transport: !isProd
		? {
				target: "pino-pretty",
				options: {
					colorize: true,
					translateTime: "yyyy-mm-dd HH:MM:ss",
					ignore: "pid,hostname",
				},
			}
		: undefined,
});

export default logger;
