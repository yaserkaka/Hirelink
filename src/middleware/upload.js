/**
 * File upload middleware (Multer) configured for Cloudinary storage.
 *
 * Exposes separate uploaders for image avatars/logos and raw resumes.
 *
 * Security notes:
 * - File size limits are enforced here to reduce abuse.
 * - File type constraints are primarily enforced by Cloudinary storage parameters.
 *
 * References:
 * - Multer: https://github.com/expressjs/multer
 * - OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
 */

import multer from "multer";
import { avatarStorage, resumeStorage } from "../config/cloudinary.js";

/**
 * Multer instance configured for avatar/logo uploads.
 */
export const uploadAvatar = multer({
	storage: avatarStorage,
	limits: {
		fileSize: 25 * 1024 * 1024,
	},
});

/**
 * Multer instance configured for resume uploads.
 */
export const uploadResume = multer({
	storage: resumeStorage,
	limits: {
		fileSize: 25 * 1024 * 1024,
	},
});
