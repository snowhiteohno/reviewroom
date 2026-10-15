import { useState } from "react";
import {
  Plus,
  Check,
  ChartNoAxesColumn,
  ArrowUpRight,
  EyeOff,
} from "lucide-react";
import type { Detail, User } from "@/lib/types";
import { Modal } from "./studio-ui";
type Props = {
  detail: Detail;
  user: User;
  busy: boolean;
  mutate: (id: string, body: unknown, message?: string) => Promise<boolean>;
  onVersion: (id: string) => void;
};
export default function DesignVotes({
  detail: d,
  user,
  busy,
  mutate,
  onVersion,
}: Props) {
  const [creating, setCreating] = useState(false),
    [question, setQuestion] = useState("Which direction should we take?"),
    [choices, setChoices] = useState<string[]>(
      d.versions.slice(0, 2).map((v) => v.id),
    );
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (
      await mutate(
        d.project.id,
        { op: "poll-create", question, versionIds: choices },
        "Your design vote is ready.",
      )
    )
      setCreating(false);
  }
  return (
    <div className="votes-panel">
      <div className="votes-heading">
        <div>
          <span className="eyebrow">A FRESH PERSPECTIVE</span>
          <h3>Choose a direction.</h3>
        </div>
        {d.role !== "reviewer" && (
          <button
            className="icon-btn"
            aria-label="Start a design vote"
            disabled={d.versions.length < 2}
            title={
              d.versions.length < 2
                ? "Upload two versions to start a vote"
                : "Start a design vote"
            }
            onClick={() => setCreating(true)}
          >
            <Plus size={19} />
          </button>
        )}
      </div>
      <p className="votes-help">
        Vote without seeing anyone else’s choice. Results appear after you vote
        or when the poll closes.
      </p>
      {d.polls.length ? (
        d.polls.map((poll) => (
          <article className="design-poll" key={poll.id}>
            <div className="poll-heading">
              <ChartNoAxesColumn size={15} />
              <span>{poll.closed ? "Closed" : "Open vote"}</span>
              {poll.my_vote && (
                <span className="voted-label">
                  <Check size={11} /> Voted
                </span>
              )}
            </div>
            <h4>{poll.question}</h4>
            <div className="poll-options">
              {poll.version_ids.map((id, i) => {
                const v = d.versions.find((v) => v.id === id),
                  count = poll.counts?.[id] ?? 0,
                  percentage = poll.total
                    ? Math.round((count / poll.total) * 100)
                    : 0;
                return (
                  <div
                    key={id}
                    className={
                      "poll-option " + (poll.my_vote === id ? "your-vote" : "")
                    }
                  >
                    <button
                      className="poll-choice"
                      disabled={busy || !!poll.my_vote || poll.closed}
                      onClick={() =>
                        mutate(
                          d.project.id,
                          { op: "vote", pollId: poll.id, versionId: id },
                          "Your vote is saved. Here are the results.",
                        )
                      }
                      aria-label={
                        "Vote for option " + String.fromCharCode(65 + i)
                      }
                    >
                      <img
                        src={"/api/assets/" + id}
                        alt={"Option " + String.fromCharCode(65 + i)}
                      />
                      <span>
                        Option {String.fromCharCode(65 + i)}
                        {poll.my_vote === id && <Check size={12} />}
                      </span>
                    </button>
                    <button
                      className="poll-version-link"
                      onClick={() => onVersion(id)}
                    >
                      Version {v?.number}
                      <ArrowUpRight size={11} />
                    </button>
                    {poll.counts && (
                      <div className="poll-result">
                        <div>
                          <span style={{ width: percentage + "%" }} />
                        </div>
                        <span>
                          {percentage}%
                          <small>
                            {count} {count === 1 ? "vote" : "votes"}
                          </small>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {poll.counts ? (
              <p className="poll-total">
                {poll.total} {poll.total === 1 ? "vote" : "votes"} collected
                {!poll.closed && ". Voting is still open."}
              </p>
            ) : (
              <p className="poll-hidden">
                <EyeOff size={12} /> Results are hidden until you vote.
              </p>
            )}
            {!poll.closed &&
              (d.role === "owner" || poll.creator_id === user.userId) &&
              d.role !== "reviewer" && (
                <button
                  className="close-poll"
                  disabled={busy}
                  onClick={() =>
                    mutate(
                      d.project.id,
                      { op: "poll-close", pollId: poll.id },
                      "Voting closed. Results are now visible to everyone.",
                    )
                  }
                >
                  Close voting and reveal results
                  <ArrowUpRight size={12} />
                </button>
              )}
          </article>
        ))
      ) : (
        <div className="no-comments">
          <ChartNoAxesColumn size={30} strokeWidth={1.2} />
          <h3>Two ideas. A fresh choice.</h3>
          <p>
            {d.versions.length < 2
              ? "Upload another version to compare directions with your team."
              : "Start a vote and let your teammates choose a direction."}
          </p>
        </div>
      )}
      {creating && (
        <Modal
          title="Let’s choose a direction"
          description="Pick two or three designs. Each teammate gets one blind vote."
          onClose={() => setCreating(false)}
        >
          <form onSubmit={create}>
            <label className="field-label">
              Your question
              <input
                autoFocus
                required
                maxLength={150}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </label>
            <div className="poll-version-picker">
              {d.versions.map((v) => (
                <label
                  key={v.id}
                  className={choices.includes(v.id) ? "selected" : ""}
                >
                  <input
                    type="checkbox"
                    checked={choices.includes(v.id)}
                    disabled={!choices.includes(v.id) && choices.length >= 3}
                    onChange={() =>
                      setChoices((prev) =>
                        prev.includes(v.id)
                          ? prev.filter((x) => x !== v.id)
                          : [...prev, v.id],
                      )
                    }
                  />
                  <img
                    src={"/api/assets/" + v.id}
                    alt={"Version " + v.number}
                  />
                  <span>Version {v.number}</span>
                </label>
              ))}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="button secondary"
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={busy || choices.length < 2}
              >
                <Plus size={15} /> Start vote
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
