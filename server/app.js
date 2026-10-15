import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import path from "node:path";
import {authRoutes} from "./routes/auth.routes.js";
import {projectRoutes,studioRoutes} from "./routes/project.routes.js";
import {uploadRoutes,assetRoutes} from "./routes/upload.routes.js";
import {checkOrigin} from "./middleware/auth.js";
import {errorHandler} from "./utils/errors.js";
export function createApp(config){
 const app=express();app.disable("x-powered-by");app.use(helmet({contentSecurityPolicy:config.production?undefined:false}));app.use(cookieParser());app.use(express.json({limit:"32kb"}));app.use("/api",checkOrigin(config));app.use("/api",(req,res,next)=>{res.set("Cache-Control","no-store");next()});
 app.get("/api/health",(req,res)=>res.json({ok:true}));
 app.use("/api/auth",authRoutes(config));
 app.use("/api/projects",uploadRoutes(config));app.use("/api/assets",assetRoutes(config));
 app.use("/api/projects",projectRoutes(config));app.use("/api/studio",studioRoutes(config));
 app.use("/api",(req,res)=>res.status(404).json({error:"This endpoint could not be found."}));
 app.use("/samples",express.static(path.resolve("client/public/samples")));
 app.use(express.static(path.resolve("dist/client")));
 app.use((req,res,next)=>{if(req.method==="GET")return res.sendFile(path.resolve("dist/client/index.html"),error=>error&&next(error));res.status(404).json({error:"This page could not be found."})});
 app.use(errorHandler);return app;
}
