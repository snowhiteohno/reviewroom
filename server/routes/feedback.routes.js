import { Router } from "express";
import {
  addComment,
  updateComment,
} from "../controllers/feedback.controller.js";
export function feedbackRoutes(config) {
  const router = Router();
  router.post("/:id/comments", addComment);
  router.patch("/:id/comments/:commentId", updateComment);
  return router;
}
