import {Router} from "express";
import multer from "multer";
import {authenticate} from "../middleware/auth.js";
import {uploadController} from "../controllers/upload.controller.js";
import {access,requireEditor} from "../services/projects.js";
export function uploadRoutes(config){const router=Router(),controller=uploadController(config),upload=multer({storage:multer.memoryStorage(),limits:{fileSize:12*1024*1024,files:1,fields:0,parts:1}});router.use(authenticate(config));router.post("/:id/upload",async(req,res,next)=>{const {role}=await access(req.params.id,req.user);requireEditor(role);next()},upload.single("file"),controller.upload);return router}
export function assetRoutes(config){const router=Router();router.use(authenticate(config));router.get("/:id",uploadController(config).asset);return router}
