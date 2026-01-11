/**
 * Talent service.
 *
 * Implements talent-specific profile operations:
 * - creating the TALENT user + profile
 * - updating profile fields
 * - managing profile files stored in Cloudinary (avatar/resume)
 * - managing skills and languages used for recommendations
 *
 * Notes:
 * - Skill/language input is normalized into a stable `normalizedName` key to prevent duplicates
 *   and to match user-typed variants (for example, "Node.js" versus "nodejs").
 * - File storage is delegated to `profileFile.service.js`.
 * - Role/profile invariants are enforced: TALENT users must have a talent profile and must not
 *   have an employer profile.
 *
 * References:
 * - Prisma Client queries: https://www.prisma.io/docs/orm/prisma-client/queries
 * - Cloudinary docs: https://cloudinary.com/documentation
 */

import env from "../config/env.js";
import {Role} from "../generated/prisma/client.ts";
import prisma from "../lib/prisma.js";
import errorUtils from "../utils/error.utils.js";
import {generateToken, generateUlid, parseExpiry,} from "../utils/general.utils.js";
import {normalizeDisplayName, normalizedNameKey,} from "../utils/nameNormalization.utils.js";
import {result} from "../utils/response.utils.js";
import statusCodes from "../utils/statusCodes.utils.js";
import {deleteProfileFile, getProfileFileUrl, updateProfileFile,} from "./profileFile.service.js";

/**
 * Creates a new TALENT user and associated talent profile.
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
				role: Role.TALENT,
				talentProfile: {
					create: {
                        // TALENT: do not create an employer profile
						id: generateUlid(),
						...profileData,
					},
				},
			},
			include: {
				talentProfile: true,
			},
		}),
	);

	if (error) {
		return result({
			ok: false,
			statusCode: statusCodes.CONFLICT,
			message: "talent with this email already exists",
		});
	}

	return result({
		ok: true,
		statusCode: statusCodes.CREATED,
		message: "talent created",
		payload: user,
	});
}

async function getTalent(userId) {
    const user = await prisma.user.findUnique({
        where: {id: userId},
        select: {
            id: true,
            role: true,
            talentProfile: {select: {id: true}},
            employerProfile: {select: {id: true}},
		},
	});

	if (!user) {
        return {
            ok: false,
            result: result({
                ok: false,
                statusCode: statusCodes.NOT_FOUND,
                message: "talent not found",
            }),
        };
	}

    if (user.role !== Role.TALENT) {
        return {
            ok: false,
            result: result({
                ok: false,
                statusCode: statusCodes.FORBIDDEN,
                message: "forbidden",
            }),
        };
    }

    if (!user.talentProfile) {
        return {
            ok: false,
            result: result({
				ok: false,
				statusCode: statusCodes.NOT_FOUND,
				message: "talent not found",
            }),
        };
    }

    if (user.employerProfile) {
        return {
            ok: false,
            result: result({
                ok: false,
                statusCode: statusCodes.CONFLICT,
                message: "role/profile mismatch",
            }),
        };
    }

    return {ok: true, user};
}

async function getTalentIdByUserId(userId) {
    const talent = await prisma.talent.findUnique({
        where: {userId},
        select: {id: true},
    });
    return talent?.id;
}

async function getOrCreateSkillByNormalizedName(tx, {name, normalizedName}) {
    if (normalizedName) {
        const byNormalized = await tx.skill.findFirst({
            where: {normalizedName},
            select: {id: true, name: true, normalizedName: true},
        });
        if (byNormalized) return byNormalized;
    }

    const byName = await tx.skill.findFirst({
        where: {name: {equals: name, mode: "insensitive"}},
        select: {id: true, name: true, normalizedName: true},
    });

    if (byName) {
        if (byName.normalizedName == null && normalizedName) {
            try {
                return await tx.skill.update({
                    where: {id: byName.id},
                    data: {normalizedName},
                    select: {id: true, name: true, normalizedName: true},
                });
            } catch (_e) {
                const canonical = await tx.skill.findFirst({
                    where: {normalizedName},
                    select: {id: true, name: true, normalizedName: true},
                });
                if (canonical) return canonical;
            }
        }
        return byName;
    }

    return tx.skill.create({
        data: {
            id: generateUlid(),
            name,
            normalizedName: normalizedName || null,
        },
        select: {id: true, name: true, normalizedName: true},
    });
}

async function getOrCreateLanguageByNormalizedName(tx, {name, normalizedName}) {
    if (normalizedName) {
        const byNormalized = await tx.language.findFirst({
            where: {normalizedName},
            select: {id: true, name: true, normalizedName: true},
        });
        if (byNormalized) return byNormalized;
    }

    const byName = await tx.language.findFirst({
        where: {name: {equals: name, mode: "insensitive"}},
        select: {id: true, name: true, normalizedName: true},
    });

    if (byName) {
        if (byName.normalizedName == null && normalizedName) {
            try {
                return await tx.language.update({
                    where: {id: byName.id},
                    data: {normalizedName},
                    select: {id: true, name: true, normalizedName: true},
                });
            } catch (_e) {
                const canonical = await tx.language.findFirst({
                    where: {normalizedName},
                    select: {id: true, name: true, normalizedName: true},
                });
                if (canonical) return canonical;
            }
        }
        return byName;
    }

    return tx.language.create({
        data: {
            id: generateUlid(),
            name,
            normalizedName: normalizedName || null,
        },
        select: {id: true, name: true, normalizedName: true},
    });
}

export async function setSkills(userId, skills) {
    const guard = await getTalent(userId);
    if (!guard.ok) {
        return guard.result;
    }

    const talentId = await getTalentIdByUserId(userId);
    if (!talentId) {
        return result({
            ok: false,
            statusCode: statusCodes.NOT_FOUND,
            message: "talent not found",
        });
    }

    const uniqueBySlug = new Map();
    for (const s of skills || []) {
        const name = normalizeDisplayName(s?.name);
        const key = normalizedNameKey(name);
        if (!name || !key) continue;
        if (!uniqueBySlug.has(key)) {
            uniqueBySlug.set(key, {
                name,
                normalizedName: key,
                level: s?.level,
            });
        }
    }
    const normalized = Array.from(uniqueBySlug.values());

    const payload = await prisma.$transaction(async (tx) => {
        await tx.talentSkill.deleteMany({where: {talentId}});
        if (normalized.length === 0) {
            return {skills: []};
        }

        const skillRows = [];
        for (const s of normalized) {
            const row = await getOrCreateSkillByNormalizedName(tx, s);
            skillRows.push({skill: row, level: s.level || "INTERMEDIATE"});
        }

        await tx.talentSkill.createMany({
            data: skillRows.map((s) => ({
                id: generateUlid(),
                talentId,
                skillId: s.skill.id,
                level: s.level,
            })),
        });

        return {
            skills: skillRows.map((s) => ({
                skillId: s.skill.id,
                name: s.skill.name,
                level: s.level,
            })),
        };
    });

    return result({
        ok: true,
        statusCode: statusCodes.OK,
        message: "talent skills updated",
        payload,
    });
}

export async function setLanguages(userId, languages) {
    const guard = await getTalent(userId);
    if (!guard.ok) {
        return guard.result;
    }

    const talentId = await getTalentIdByUserId(userId);
    if (!talentId) {
        return result({
            ok: false,
            statusCode: statusCodes.NOT_FOUND,
            message: "talent not found",
        });
    }

    const uniqueBySlug = new Map();
    for (const l of languages || []) {
        const name = normalizeDisplayName(l?.name);
        const key = normalizedNameKey(name);
        if (!name || !key) continue;
        if (!uniqueBySlug.has(key)) {
            uniqueBySlug.set(key, {
                name,
                normalizedName: key,
                proficiency: l?.proficiency,
			});
		}
    }
    const normalized = Array.from(uniqueBySlug.values());

    const payload = await prisma.$transaction(async (tx) => {
        await tx.talentLanguage.deleteMany({where: {talentId}});
        if (normalized.length === 0) {
            return {languages: []};
        }

        const languageRows = [];
        for (const l of normalized) {
            const row = await getOrCreateLanguageByNormalizedName(tx, l);
            languageRows.push({
                language: row,
                proficiency: l.proficiency || "INTERMEDIATE",
            });
        }

        await tx.talentLanguage.createMany({
            data: languageRows.map((l) => ({
                id: generateUlid(),
                talentId,
                languageId: l.language.id,
                proficiency: l.proficiency,
            })),
        });

        return {
            languages: languageRows.map((l) => ({
                languageId: l.language.id,
                name: l.language.name,
                proficiency: l.proficiency,
            })),
        };
    });

    return result({
        ok: true,
        statusCode: statusCodes.OK,
        message: "talent languages updated",
        payload,
    });
}

/**
 * Updates talent profile fields.
 * @param {string} id
 * @param {object} profileData
 */
export async function updateProfile(id, profileData) {
    const guard = await getTalent(id);
    if (!guard.ok) {
        return guard.result;
    }

    const user = await prisma.user.update({
        where: {id},
        data: {
            talentProfile: {
                update: {
                    ...profileData,
                },
            },
        },
        include: {
            talentProfile: true,
        },
    });

    if (!user) {
        return result({
            ok: false,
            statusCode: statusCodes.NOT_FOUND,
            message: "talent not found",
        });
    }

    return result({
        ok: true,
        statusCode: statusCodes.OK,
        message: "talent updated",
        payload: user,
    });
}

/**
 * Updates a talent profile file reference (avatar/resume).
 * @param {"avatar"|"resume"} type
 * @param {string} id
 * @param {import("multer").File} file
 */
export async function updateFile(type, id, file) {
    const response = await updateProfileFile({
        userId: id,
        profileKey: "talentProfile",
        field: `${type}PublicId`,
        file,
        resourceType: type === "avatar" ? "image" : "raw",
    });

    return {
        ...response,
        message: response.ok ? `talent ${type} updated` : `error updating ${type}`,
    };
}

/**
 * Gets a Cloudinary URL for a talent profile file.
 * @param {"avatar"|"resume"} type
 * @param {string} id
 * @param {{ width?: number, height?: number }} options
 */
export async function getFile(type, id, {width = 200, height = 200}) {
    const response = await getProfileFileUrl({
        userId: id,
        profileKey: "talentProfile",
        field: `${type}PublicId`,
        resourceType: type === "avatar" ? "image" : "raw",
        folder: `${type}s`,
        responseKey: type,
        width: Number(width),
        height: Number(height),
    });

    return {
        ...response,
        message: response.ok ? `talent ${type} fetched` : `error fetching ${type}`,
    };
}

/**
 * Deletes a talent profile file.
 * @param {"avatar"|"resume"} type
 * @param {string} id
 */
export async function deleteFile(type, id) {
    const response = await deleteProfileFile({
        userId: id,
        profileKey: "talentProfile",
        field: `${type}PublicId`,
        resourceType: type === "avatar" ? "image" : "raw",
    });

    return {
        ...response,
        message: response.ok ? `talent ${type} deleted` : `error deleting ${type}`,
    };
}
