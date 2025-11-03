import { prisma } from "../../prisma/client.js";
import { getPagination } from "../Utils/pagination.utils.js";
import { buildFilters } from "../Utils/filters.utils.js";
import { createRecord } from "../Utils/db.utils.js";
import { JOBS_MESSAGES } from "../Utils/Constants/messages.js";
import STATUS_CODES from "../Utils/Constants/statuscode.js";
import { ServiceError } from "../Utils/serviceError.utils.js";

//create job
export const createJobService = async (userId , jobData) => {

    //console.log(userId ,"\n", jobData);
    
    const company = await prisma.user.findFirst({ where: { id: userId , role: "COMPANY"} });

    if (!company) throw new ServiceError( JOBS_MESSAGES.ONLY_COMPANY_CAN_CREATE_JOB, STATUS_CODES.FORBIDDEN);

    return createRecord("job", { ...jobData, companyId: company.id });

};









//Get all jobs with search, filter, and pagination
export const getAllJobsService = async ( params ) => {
    
    const { page , limit, ...filterParam } = params;

    const { skip, take } = getPagination(page, limit);

    const filters = buildFilters(filterParam, {
        numericFields: ["companyId" , "salaryRange"],
        booleanFields: ['isRemote']
    });

    return prisma.job.findMany({

        skip,
        take,
        where: filters,

        include: {
            company: true
        }
    });


};