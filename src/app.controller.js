import authRouter from "./Modules/Auth/auth.controller.js";
import userRouter from "./Modules/User/user.controller.js";
import adminRouter from "./Modules/Admin/admin.controller.js";
//import connectDB from "./DB/connection.js";
//import { globalErrorHanndler } from "./Utils/errorHandling.utils.js";

const bootstrap = async (app , express) => {
    
    app.use(express.json());

  //  connectDB
    
    app.use("/api/auth" , authRouter);
    app.use("/api/user" , userRouter);
    app.use("/api/admin" , adminRouter);

    app.all("/*dummy" , (req , res, next) => {
      return next(new Error("Not Found Handler!!", {cause : 404}));
        
    });
    
    //global error handler middleware

}

export default bootstrap;