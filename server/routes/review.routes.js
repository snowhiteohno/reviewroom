import {Router} from "express";
import {authenticate} from "../middleware/auth.js";
import {changeReview} from "../controllers/review.controller.js";
export function reviewRoutes(config){const router=Router();router.use(authenticate(config));router.post("/:id/review",changeReview);return router}
