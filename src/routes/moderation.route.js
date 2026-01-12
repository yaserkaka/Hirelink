/**
 * Moderation routes.
 *
 * All routes require authentication and the MODERATOR role.
 *
 * Notes:
 * - The router mounts `requireAuth` + `requireRole("MODERATOR")` once for all routes.
 * - Business rules (for example, preventing moderator deactivation) are enforced in the service layer.
 *
 * References:
 * - OWASP Access Control: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
 */

import { Router } from "express";
import { moderationController } from "../controllers/index.js";
import requireAuth from "../middleware/requireAuth.js";
import requireRole from "../middleware/requireRole.js";
import validate from "../middleware/validate.js";
import { setUserActiveSchema } from "../validators/moderation.validator.js";

const router = Router();

router.use(requireAuth, requireRole("MODERATOR"));

router.get("/stats", moderationController.stats);

router.get("/users", moderationController.listUsers);
router.delete("/users/:userId", moderationController.deleteUser);
router.patch(
	"/users/:userId/active",
	validate(setUserActiveSchema),
	moderationController.setUserActive,
);

router.get("/jobs", moderationController.listJobs);
router.delete("/jobs/:jobId", moderationController.deleteJob);

export default router;
