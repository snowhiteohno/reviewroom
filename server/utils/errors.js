export class ApiError extends Error{constructor(status,message){super(message);this.status=status}}
export function parse(schema,value){const result=schema.safeParse(value);if(!result.success)throw new ApiError(400,result.error.issues[0]?.message||"Please check the submitted information.");return result.data}
export function errorHandler(error,req,res,next){
 if(res.headersSent)return next(error);
 let status=error.status||500,message=error.message;
 if(error.code===11000){status=409;message="This record already exists."}
 if(error.name==="ValidationError"){status=400;message="Please check the submitted information."}
 if(error.code==="LIMIT_FILE_SIZE"){status=413;message="Please choose an image smaller than 12 MB."}
 if(error instanceof SyntaxError&&"body" in error){status=400;message="Please submit valid JSON."}
 if(status>=500){console.error(error);message="Something went wrong. Please try again."}
 res.status(status).json({error:message});
}
