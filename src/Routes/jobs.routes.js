import { Router } from "express";
import verifyToken  from "../Middlewares/verifyToken.js";
import { createJob, deleteJob, getAllJobs, getJobById, updateJob } from "../Controllers/jobs.controller.js";

const router = Router();

// create job
router.post("/", verifyToken, createJob); // Employer only

// DELETE job by id
router.delete("/:id", verifyToken, deleteJob);

// UPDATE job by id
router.put("/:id", verifyToken, updateJob);

// GET all jobs
router.get("/",  getAllJobs);

// GET job by id
router.get("/:id", verifyToken, getJobById);


export default router;