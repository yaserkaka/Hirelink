
import { prisma } from "../../prisma/client.js"




//create record in database
export const createRecord = async (model, data) => {

    if (!prisma[model]) throw new Error(`Model ${model} not found`);
    
    
    
    return await prisma[model].create({ data });
};