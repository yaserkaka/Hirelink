import { successResponse } from "../Utils/successResponse.utils.js";
import { getAllJobsService , createJobService } from "../Services/jobs.services.js";
import STATUS_CODES from "../Utils/Constants/statuscode.js";
import { JOBS_MESSAGES , COMMON_MESSAGES} from "../Utils/Constants/messages.js"
import { jobSchemaValidation } from "../Validation/jobs.validation.js";





//create job
export const createJob = async (req, res, next) => {

    const { error , value } = jobSchemaValidation.validate(req.body);

    if (error) throw new Error(error.details[0].message);
    
    const job = await createJobService(req.user.id , value);

    successResponse({ res, statusCode: STATUS_CODES.CREATED, message: COMMON_MESSAGES.CREATED_SUCCESS, data: job });
};

//update job
export const updateJob = async (req, res, next) => {};

//delete job
export const deleteJob = async (req, res, next) => {};

//get job by id
export const getJobById = async (req, res, next) => {};


//GET all jobs
export const getAllJobs = async (req, res, next) => {

    const jobs = await getAllJobsService(req.query);
  
    successResponse({ res, statusCode: STATUS_CODES.OK, message:JOBS_MESSAGES.ALL_FETCH_SUCCESS , data: jobs });
};
