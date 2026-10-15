import {Router} from "express";
import {authenticate} from "../middleware/auth.js";
import * as controller from "../controllers/project.controller.js";
export function projectRoutes(config){const router=Router();router.use(authenticate(config));router.get("/",controller.studio);router.post("/",controller.createProject);router.get("/:id",controller.detail);router.patch("/:id",controller.updateProject);router.put("/:id/favorite",controller.favorite);router.post("/:id/members",controller.addMember);router.delete("/:id/members",controller.removeMember);return router}
export function studioRoutes(config){const router=Router();router.use(authenticate(config));router.get("/",controller.studio);router.post("/",controller.initialize);return router}
