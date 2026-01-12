/**
 * Employer service.
 *
 * Implements employer-specific profile operations:
 * - creating the EMPLOYER user + profile
 * - updating profile fields
 * - managing the logo stored in Cloudinary (saved as employerProfile.avatarPublicId)
 *
 * Notes:
 * - Employer job create, list, update, and delete operations are implemented in `job.service.js` and routed via employer routes.
 * - File storage is delegated to `profileFile.service.js`.
 * - Role/profile invariants are enforced: EMPLOYER users must have an employer profile and must not
 *   have a talent profile.
 *
 * References:
 * - Prisma Client queries: https://www.prisma.io/docs/orm/prisma-client/queries
 * - Cloudinary docs: https://cloudinary.com/documentation
 */

import env from "../config/env.js";
import { Role } from "../generated/prisma/client.ts";
import prisma from "../lib/prisma.js";
import errorUtils from "../utils/error.utils.js";
import {
	generateToken,
	generateUlid,
	parseExpiry,
} from "../utils/general.utils.js";
import { result } from "../utils/response.utils.js";
import statusCodes from "../utils/statusCodes.utils.js";
import {
	deleteProfileFile,
	getProfileFileUrl,
	updateProfileFile,
} from "./profileFile.service.js";

/**
 * Creates a new EMPLOYER user and associated employer profile.
 * @param {{ email: string, password: string, profileData: object }} params Parameters.
 */
export async function createProfile({ email, password, profileData }) {
	const verificationToken = generateToken();

	const [error, user] = await errorUtils(
		prisma.user.create({
			data: {
				id: generateUlid(),
				email,
				password,
				verificationToken,
				verificationExpiresAt: new Date(
					Date.now() + parseExpiry(env.EMAIL_VERIFICATION_EXPIRY),
				),
				role: Role.EMPLOYER,
				employerProfile: {
					// EMPLOYER: do not create a talent profile
					create: {
						id: generateUlid(),
						...profileData,
					},
				},
			},
			include: {
				employerProfile: true,
			},
		}),
	);

	if (error) {
		return result({
			ok: false,
			statusCode: statusCodes.CONFLICT,
			message: "user with this email already exists",
		});
	}

	return result({
		ok: true,
		statusCode: statusCodes.CREATED,
		message: "user created",
		payload: user,
	});
}

async function getEmployer(userId) {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			role: true,
			employerProfile: { select: { id: true } },
			talentProfile: { select: { id: true } },
		},
	});

	if (!user) {
		return {
			ok: false,
			result: result({
				ok: false,
				statusCode: statusCodes.NOT_FOUND,
				message: "employer not found",
			}),
		};
	}

	if (user.role !== Role.EMPLOYER) {
		return {
			ok: false,
			result: result({
				ok: false,
				statusCode: statusCodes.FORBIDDEN,
				message: "forbidden",
			}),
		};
	}

	if (!user.employerProfile) {
		return {
			ok: false,
			result: result({
				ok: false,
				statusCode: statusCodes.NOT_FOUND,
				message: "employer not found",
			}),
		};
	}

	if (user.talentProfile) {
		return {
			ok: false,
			result: result({
				ok: false,
				statusCode: statusCodes.CONFLICT,
				message: "role/profile mismatch",
			}),
		};
	}

	return { ok: true, user };
}

/**
 * Updates employer profile data.
 * @param {string} id
 * @param {object} profileData
 */
export async function updateProfile(id, profileData) {
	const guard = await getEmployer(id);
	if (!guard.ok) {
		return guard.result;
	}

	const user = await prisma.user.update({
		where: { id },
		data: {
			employerProfile: {
				update: {
					...profileData,
				},
			},
		},
		include: {
			employerProfile: true,
		},
	});

	if (!user) {
		return result({
			ok: false,
			statusCode: statusCodes.NOT_FOUND,
			message: "employer not found",
		});
	}

	return result({
		ok: true,
		statusCode: statusCodes.OK,
		message: "employer updated",
		payload: user,
	});
}

/**
 * Updates employer logo (stored as employerProfile.avatarPublicId).
 * @param {string} id
 * @param {import("multer").File} file
 */
export async function updateLogo(id, file) {
	const guard = await getEmployer(id);
	if (!guard.ok) {
		return guard.result;
	}

	const response = await updateProfileFile({
		userId: id,
		profileKey: "employerProfile",
		field: "avatarPublicId",
		file,
		resourceType: "image",
	});

	return {
		...response,
		message: response.ok ? "employer logo updated" : "error updating logo",
	};
}

/**
 * Gets employer logo URL.
 * @param {string} id
 * @param {{ width?: number, height?: number }} options
 */
export async function getLogo(id, { width = 200, height = 200 }) {
	const guard = await getEmployer(id);
	if (!guard.ok) {
		return guard.result;
	}

	const response = await getProfileFileUrl({
		userId: id,
		profileKey: "employerProfile",
		field: "avatarPublicId",
		resourceType: "image",
		folder: "avatars",
		responseKey: "logo",
		width: Number(width),
		height: Number(height),
	});

	const message = response.ok
		? "employer logo fetched"
		: response.statusCode === statusCodes.NOT_FOUND
			? response.message === "file not found"
				? "logo not set"
				: response.message
			: "error fetching logo";

	return {
		...response,
		message,
	};
}

/**
 * Deletes employer logo.
 * @param {string} id
 */
export async function deleteLogo(id) {
	const guard = await getEmployer(id);
	if (!guard.ok) {
		return guard.result;
	}

	const response = await deleteProfileFile({
		userId: id,
		profileKey: "employerProfile",
		field: "avatarPublicId",
		resourceType: "image",
	});

	return {
		...response,
		message: response.ok ? "employer logo deleted" : "error deleting logo",
	};
}
