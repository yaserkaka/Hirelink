/**
 * Service barrel export.
 *
 * Centralizes service imports/exports so controllers and other modules can
 * import from a single place.
 *
 * Notes:
 * - Services implement business rules and should not depend on Express.
 * - Controllers should call services, then translate their results into HTTP responses.
 *
 * References:
 * - Node ESM modules: https://nodejs.org/api/esm.html
 */

import * as applicationService from "./application.service.js";
import * as authService from "./auth.service.js";
import * as emailService from "./email.service.js";
import * as employerService from "./employer.service.js";
import * as jobService from "./job.service.js";
import * as moderationService from "./moderation.service.js";
import * as talentService from "./talent.service.js";
import * as tokenService from "./token.service.js";
import * as userService from "./user.service.js";
import * as verificationService from "./verification.service.js";

export {
	authService,
	applicationService,
	emailService,
	employerService,
	jobService,
	moderationService,
	talentService,
	tokenService,
	userService,
	verificationService,
};
