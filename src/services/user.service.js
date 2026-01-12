/**
 * User lookup service.
 *
 * Provides helpers to find users by email or id.
 *
 * Note:
 * - It works with Talent & Employer
 *
 */

import {z} from "zod";
import prisma from "../lib/prisma.js";

/**
 * Finds a user by email or id.
 * @param {string} identifier
 * @returns {Promise<import("../generated/prisma/client.ts").User | null>}
 */
export async function findUser(identifier) {
	if (!identifier) {
		return null;
	}

	const baseSelect = {
		id: true,
		email: true,
		password: true,
		isActive: true,
		role: true,
		isEmailVerified: true,
		verificationToken: true,
		verificationExpiresAt: true,
		createdAt: true,
		updatedAt: true,
	};

	// If it looks like an email address
	if (z.email().safeParse(identifier).success) {
		return prisma.user.findUnique({
			where: { email: identifier },
			select: baseSelect,
		});
	}

	// Otherwise, treat it as an id
	const roleRow = await prisma.user.findUnique({
		where: {id: identifier},
		select: {role: true},
	});
	if (!roleRow) {
		return null;
	}

	return prisma.user.findUnique({
		where: { id: identifier },
		select: {
			...baseSelect,
			...(roleRow.role === "TALENT" ? {talentProfile: true} : {}),
			...(roleRow.role === "EMPLOYER" ? {employerProfile: true} : {}),
		},
	});
}
