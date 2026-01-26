/**
 * Application service.
 *
 * Implements application-related business logic:
 * - talent applying to a job
 * - listing applications for the talent
 * - listing applications for an employer-owned job
 * - updating application status for employer-owned jobs
 *
 * Notes:
 * - Ownership checks are done by matching employerId/talentId using profile lookups.
 * - The `(jobId, talentId)` combination is unique to prevent duplicate applications.
 *
 * References:
 * - Prisma transactions: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
 */

import prisma from "../lib/prisma.js";
import { generateUlid } from "../utils/general.utils.js";
import { result } from "../utils/response.utils.js";
import statusCodes from "../utils/statusCodes.utils.js";

/**
 * Gets the talent profile id for a given user id.
 * @param {string} userId
 */
async function getTalentByUserId(userId) {
	return prisma.talent.findUnique({
		where: { userId },
		select: { id: true },
	});
}

/**
 * Gets the employer profile id for a given user id.
 * @param {string} userId
 */
async function getEmployerByUserId(userId) {
	return prisma.employer.findUnique({
		where: { userId },
		select: { id: true },
	});
}

/**
 * Applies to a job as the authenticated talent.
 * @param {string} userId
 * @param {string} jobId
 * @param {{ coverLetter?: string, resumeUrl?: string }} payload
 */
export async function applyToJob(userId, jobId, payload) {
	const talent = await getTalentByUserId(userId);
	if (!talent) {
		return result({
			ok: false,
			statusCode: statusCodes.NOT_FOUND,
			message: "talent not found",
		});
	}

	const job = await prisma.job.findUnique({
		where: { id: jobId },
		select: { id: true },
	});

	if (!job) {
		return result({
			ok: false,
			statusCode: statusCodes.NOT_FOUND,
			message: "job not found",
		});
	}

	try {
		const app = await prisma.application.create({
			data: {
				id: generateUlid(),
				jobId,
				talentId: talent.id,
				coverLetter: payload.coverLetter,
				resumeUrl: payload.resumeUrl,
			},
		});

		return result({
			ok: true,
			statusCode: statusCodes.CREATED,
			message: "application created",
			payload: app,
		});
	} catch {
		return result({
			ok: false,
			statusCode: statusCodes.CONFLICT,
			message: "already applied",
		});
	}
}

/**
 * Lists applications for the authenticated talent.
 * @param {string} userId
 */
export async function listTalentApplications(userId) {
	const talent = await getTalentByUserId(userId);
	if (!talent) {
		return result({
			ok: false,
			statusCode: statusCodes.NOT_FOUND,
			message: "talent not found",
		});
	}

	const apps = await prisma.application.findMany({
		where: { talentId: talent.id },
		orderBy: { createdAt: "desc" },
		include: {
			job: {
				include: {
					employer: { select: { companyName: true } },
				},
			},
		},
	});

	return result({
		ok: true,
		statusCode: statusCodes.OK,
		message: "applications fetched",
		payload: apps,
	});
}

/**
 * Lists applications for a job owned by the authenticated employer.
 * @param {string} userId
 * @param {string} jobId
 */
export async function listEmployerJobApplications(userId, jobId) {
	const employer = await getEmployerByUserId(userId);
	if (!employer) {
		return result({
			ok: false,
			statusCode: statusCodes.NOT_FOUND,
			message: "employer not found",
		});
	}

	const job = await prisma.job.findFirst({
		where: { id: jobId, employerId: employer.id },
		select: { id: true },
	});

	if (!job) {
		return result({
			ok: false,
			statusCode: statusCodes.NOT_FOUND,
			message: "job not found",
		});
	}

	const apps = await prisma.application.findMany({
		where: { jobId },
		orderBy: { createdAt: "desc" },
		include: {
			talent: {
				include: {
					user: { select: { email: true } },
					certificates: {
						select: {
							id: true,
							name: true,
							issuer: true,
							credentialUrl: true,
							credentialId: true,
							issueDate: true,
							expiryDate: true,
							createdAt: true,
						},
						orderBy: { createdAt: "asc" },
					},
				},
			},
		},
	});

	for (const app of apps) {
		if (app?.talent?.certificates) {
			app.talent.certificates = app.talent.certificates.map((c) => ({
				certificateId: c.id,
				name: c.name,
				issuer: c.issuer,
				credentialUrl: c.credentialUrl,
				credentialId: c.credentialId,
				issueDate: c.issueDate,
				expiryDate: c.expiryDate,
				createdAt: c.createdAt,
			}));
		}
	}

	return result({
		ok: true,
		statusCode: statusCodes.OK,
		message: "applications fetched",
		payload: apps,
	});
}

/**
 * Updates an application status for a job owned by the authenticated employer.
 * @param {string} userId
 * @param {string} applicationId
 * @param {"APPLIED"|"REJECTED"|"HIRED"} status
 */
export async function updateEmployerApplicationStatus(
	userId,
	applicationId,
	status,
) {
	const employer = await getEmployerByUserId(userId);
	if (!employer) {
		return result({
			ok: false,
			statusCode: statusCodes.NOT_FOUND,
			message: "employer not found",
		});
	}

	const app = await prisma.application.findUnique({
		where: { id: applicationId },
		include: {
			job: { select: { employerId: true } },
		},
	});

	if (!app || app.job.employerId !== employer.id) {
		return result({
			ok: false,
			statusCode: statusCodes.NOT_FOUND,
			message: "application not found",
		});
	}

	const updated = await prisma.application.update({
		where: { id: applicationId },
		data: { status },
	});

	return result({
		ok: true,
		statusCode: statusCodes.OK,
		message: "application updated",
		payload: updated,
	});
}
