/**
 * Email transport wrapper.
 *
 * Configures Nodemailer and exposes a helper to send emails.
 *
 * Notes:
 * - You need to generate an app password for the GMAIL_USER in order to use this.
 *
 * References:
 * - Nodemailer: https://nodemailer.com/
 */

import nodemailer from "nodemailer";
import env from "../config/env.js";
import errorUtils from "../utils/error.utils.js";
import logger from "./logger.js";

const transporter = nodemailer.createTransport({
	host: env.GMAIL_HOST,
	port: 465,
	secure: true,
	auth: {
		user: env.GMAIL_USER,
		pass: env.GMAIL_PASSWORD,
	},
});

/**
 * Sends an email using the configured Nodemailer transport.
 * @param {{ to: string, subject: string, text?: string, html?: string }} params Parameters.
 * @returns {Promise<boolean>} whether the email was sent successfully
 */
export default async function sendEmail({ to, subject, text, html }) {
	const [err, _data] = await errorUtils(
		transporter.sendMail({
			from: env.GMAIL_USER,
			to,
			subject,
			text,
			html,
		}),
	);

	if (err) {
		logger.error(err);
		return false;
	}

	logger.debug(`Email sent successfully to ${to}`);
	return true;
}
