import { Poll, Vote } from "../models/index.js";
export async function pollsForProject(projectId, user) {
  const polls = await Poll.find({ projectId }).sort({ createdAt: -1 }).lean();
  const votes = await Vote.find({
    pollId: { $in: polls.map((p) => p._id) },
    userId: user._id,
  }).lean();
  const own = new Map(votes.map((v) => [v.pollId, v.versionId]));
  return Promise.all(
    polls.map(async (poll) => {
      const myVote = own.get(poll._id) || null;
      let counts = null,
        total = null;
      if (myVote || poll.closed) {
        const result = await Vote.aggregate([
          { $match: { pollId: poll._id } },
          { $group: { _id: "$versionId", count: { $sum: 1 } } },
        ]);
        counts = Object.fromEntries(
          poll.versionIds.map((id) => [
            id,
            result.find((r) => r._id === id)?.count || 0,
          ]),
        );
        total = result.reduce((n, r) => n + r.count, 0);
      }
      return {
        id: poll._id,
        question: poll.question,
        version_ids: poll.versionIds,
        creator_id: poll.creatorId,
        closed: poll.closed,
        my_vote: myVote,
        counts,
        total,
        created_at: +poll.createdAt,
      };
    }),
  );
}
