import {Router} from "express";
import {authenticate} from "../middleware/auth.js";
import {addComment,updateComment} from "../controllers/feedback.controller.js";
export function feedbackRoutes(config){const router=Router();router.use(authenticate(config));router.post("/:id/comments",addComment);router.patch("/:id/comments/:commentId",updateComment);return router}
