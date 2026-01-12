/**
 * Main API router.
 *
 * Mounts role-specific routers and public routes under the API version prefix.
 *
 * Notes:
 * - Each sub-router owns its own auth/role requirements.
 * - Keep this file focused on composition only.
 *
 * References:
 * - Express Router: https://expressjs.com/en/guide/routing.html
 */

import { Router } from "express";
import authRoute from "./auth.route.js";
import employerRoute from "./employer.route.js";
import jobsRoute from "./jobs.route.js";
import moderationRoute from "./moderation.route.js";
import talentApplicationsRoute from "./talent.applications.route.js";
import talentRoute from "./talent.route.js";

const router = Router();

router.use("/auth", authRoute);
router.use("/talent", talentRoute);
router.use("/talent", talentApplicationsRoute);
router.use("/employer", employerRoute);
router.use("/jobs", jobsRoute);
router.use("/moderation", moderationRoute);

export default router;
