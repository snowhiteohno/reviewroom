import {Router} from "express";
import {authenticate} from "../middleware/auth.js";
import {createPoll,castVote,closePoll} from "../controllers/poll.controller.js";
export function pollRoutes(config){const router=Router();router.use(authenticate(config));router.post("/:id/polls",createPoll);router.post("/:id/polls/:pollId/votes",castVote);router.patch("/:id/polls/:pollId/close",closePoll);return router}
