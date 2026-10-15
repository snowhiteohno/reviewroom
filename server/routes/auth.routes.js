import {Router} from "express";
import {rateLimit} from "express-rate-limit";
import {authenticate} from "../middleware/auth.js";
import {authController} from "../controllers/auth.controller.js";
export function authRoutes(config){const router=Router(),controller=authController(config);const limited=rateLimit({windowMs:15*60*1000,limit:config.production?20:100,standardHeaders:"draft-7",legacyHeaders:false,message:{error:"Too many attempts. Please try again in a little while."}});router.post("/register",limited,controller.register);router.post("/login",limited,controller.login);router.get("/me",authenticate(config),controller.me);router.post("/logout",authenticate(config),controller.logout);return router}
