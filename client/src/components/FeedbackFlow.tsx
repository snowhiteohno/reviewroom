import { useState } from "react";
import {
  ArrowUpRight,
  CheckCheck,
  Link2,
  RotateCcw,
  Flag,
  Check,
} from "lucide-react";
import type { Comment, Detail, User, Version } from "@/lib/types";
type Props = {
  comment: Comment;
  detail: Detail;
  user: User;
  busy: boolean;
  mutate: (id: string, body: unknown, message?: string) => Promise<boolean>;
  onVersion: (id: string) => void;
};
export function FeedbackFlow({
  comment: c,
  detail: d,
  user,
  busy,
  mutate,
  onVersion,
}: Props) {
  const [linking, setLinking] = useState(false),
    [target, setTarget] = useState("");
  const source = d.versions.find((v) => v.id === c.version_id),
    later = d.versions.filter((v) => v.number > (source?.number ?? 0)),
    linked = d.versions.find((v) => v.id === c.addressed_version_id),
    canEdit = d.role !== "reviewer";
  const canVerify =
    c.resolution === "addressed" &&
    c.addressed_by !== user.userId &&
    (d.role !== "editor" || c.author_id === user.userId);
  async function act(action: string, versionId?: string) {
    if (
      await mutate(
        d.project.id,
        { op: "feedback-state", commentId: c.id, action, versionId },
        action === "address"
          ? "Revision linked. Ready for another reviewer."
          : action === "verify"
            ? "Fix verified."
            : "Feedback reopened.",
      )
    )
      setLinking(false);
  }
  return (
    <div className="feedback-flow">
      <div className="feedback-flow-status">
        <span className={"feedback-kind " + c.kind}>
          {c.kind === "must_fix" ? <Flag size={11} /> : null}
          {c.kind === "must_fix" ? "Must fix" : "Suggestion"}
        </span>
        <span className={"resolution-label " + c.resolution}>
          {c.resolution === "verified" ? (
            <CheckCheck size={12} />
          ) : c.resolution === "addressed" ? (
            <Link2 size={11} />
          ) : null}
          {c.resolution === "verified"
            ? "Verified"
            : c.resolution === "addressed"
              ? "Addressed"
              : "Open"}
        </span>
      </div>
      {linked && (
        <button
          className="linked-revision"
          onClick={() => onVersion(linked.id)}
        >
          <Link2 size={12} /> Addressed in version {linked.number}
          <ArrowUpRight size={12} />
        </button>
      )}
      {linking ? (
        <form
          className="link-fix-form"
          onSubmit={(e) => {
            e.preventDefault();
            act("address", target || later[0]?.id);
          }}
        >
          <label>
            Which revision has the fix?
            <select
              aria-label="Revision containing the fix"
              value={target || later[0]?.id || ""}
              onChange={(e) => setTarget(e.target.value)}
            >
              {later.map((v) => (
                <option key={v.id} value={v.id}>
                  Version {v.number}
                </option>
              ))}
            </select>
          </label>
          <div>
            <button type="button" onClick={() => setLinking(false)}>
              Cancel
            </button>
            <button
              className="button secondary"
              disabled={busy || !later.length}
            >
              <Link2 size={12} /> Link revision
            </button>
          </div>
        </form>
      ) : (
        <div className="feedback-flow-actions">
          {canEdit && c.resolution !== "verified" && (
            <button
              disabled={busy || !later.length}
              title={
                later.length
                  ? "Link the revision containing your fix"
                  : "Upload a later revision to link a fix"
              }
              onClick={() => setLinking(true)}
            >
              <Link2 size={12} />{" "}
              {c.resolution === "addressed"
                ? "Update linked revision"
                : "Link a fix"}
            </button>
          )}
          {canVerify && (
            <button
              className="verify-action"
              disabled={busy}
              onClick={() => act("verify")}
            >
              <CheckCheck size={13} /> Verify fix
            </button>
          )}
          {c.resolution === "verified" &&
            (canEdit || c.author_id === user.userId) && (
              <button disabled={busy} onClick={() => act("reopen")}>
                <RotateCcw size={11} /> Reopen
              </button>
            )}
        </div>
      )}
      {c.resolution === "addressed" && c.addressed_by === user.userId && (
        <small className="verification-help">
          Another reviewer can verify this revision.
        </small>
      )}
      {canEdit &&
        c.kind === "must_fix" &&
        c.resolution === "open" &&
        !later.length && (
          <small className="verification-help">
            Upload a revision, then link it here.
          </small>
        )}
    </div>
  );
}
export function FixesPanel({
  detail: d,
  user,
  busy,
  mutate,
  onVersion,
}: Omit<Props, "comment">) {
  const items = d.comments.filter(
      (c) => !c.parent_id && (c.kind === "must_fix" || c.addressed_version_id),
    ),
    verified = items.filter((c) => c.resolution === "verified").length;
  return (
    <div className="fixes-panel">
      <div className="fixes-intro">
        <span className="eyebrow">FEEDBACK TO FIX</span>
        <h3>Every detail, followed through.</h3>
        <p>
          Link feedback to a revision, then have another reviewer verify the
          change.
        </p>
        {items.length > 0 && (
          <div className="fix-progress">
            <span
              style={{
                width: Math.round((verified / items.length) * 100) + "%",
              }}
            />
            <small>
              {verified} of {items.length} verified
            </small>
          </div>
        )}
      </div>
      {items.length ? (
        items.map((c) => (
          <article key={c.id} className="fix-card">
            <button
              className="fix-source"
              onClick={() => onVersion(c.version_id)}
            >
              From version{" "}
              {d.versions.find((v) => v.id === c.version_id)?.number}
              <ArrowUpRight size={12} />
            </button>
            <p>{c.body}</p>
            <FeedbackFlow
              comment={c}
              detail={d}
              user={user}
              busy={busy}
              mutate={mutate}
              onVersion={onVersion}
            />
          </article>
        ))
      ) : (
        <div className="no-comments">
          <CheckCheck size={29} strokeWidth={1.2} />
          <h3>A clear path ahead</h3>
          <p>Must fix feedback and linked revisions will appear here.</p>
        </div>
      )}
    </div>
  );
}
