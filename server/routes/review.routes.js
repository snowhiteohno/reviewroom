import { Router } from "express";
import { changeReview } from "../controllers/review.controller.js";
export function reviewRoutes(config) {
  const router = Router();
  router.post("/:id/review", changeReview);
  return router;
}
