/**
 * Jobs routes.
 *
 * Provides:
 * - talent-authenticated job listing and job fetch (supports recent/recommended feed)
 * - talent application endpoint (requires auth + TALENT role)
 *
 * References:
 * - Express Router: https://expressjs.com/en/guide/routing.html
 */

import { Router } from "express";
import { jobsController } from "../controllers/index.js";
import requireAuth from "../middleware/requireAuth.js";
import requireRole from "../middleware/requireRole.js";
import validate from "../middleware/validate.js";
import { applyToJobSchema } from "../validators/jobs.validator.js";

const router = Router();

router.get("/", requireAuth, requireRole("TALENT"), jobsController.list);
router.get("/:jobId", requireAuth, requireRole("TALENT"), jobsController.get);

router.post(
	"/:jobId/apply",
	requireAuth,
	requireRole("TALENT"),
	validate(applyToJobSchema),
	jobsController.apply,
);

export default router;
