/**
 * Controller barrel export.
 *
 * Centralizes controller imports/exports so routes can import from a single
 * module.
 *
 * Notes:
 * - This is an organizational convenience only (no logic should live here).
 * - Keeping exports centralized reduces unexpected circular imports in ESM.
 *
 * References:
 * - Node ESM modules: https://nodejs.org/api/esm.html
 */

import * as applicationsController from "./applications.controller.js";
import * as authController from "./auth.controller.js";
import * as employerController from "./employer.controller.js";
import * as jobsController from "./jobs.controller.js";
import * as moderationController from "./moderation.controller.js";
import * as talentController from "./talent.controller.js";

export {
	applicationsController,
	authController,
	employerController,
	jobsController,
	moderationController,
	talentController,
};
