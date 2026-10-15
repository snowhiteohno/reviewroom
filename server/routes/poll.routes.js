import { Router } from "express";
import {
  createPoll,
  castVote,
  closePoll,
} from "../controllers/poll.controller.js";
export function pollRoutes(config) {
  const router = Router();
  router.post("/:id/polls", createPoll);
  router.post("/:id/polls/:pollId/votes", castVote);
  router.patch("/:id/polls/:pollId/close", closePoll);
  return router;
}
