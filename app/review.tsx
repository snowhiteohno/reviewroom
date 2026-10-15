"use client";
import {
  useState,
  useEffect,
  useRef,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Flower2,
  Users,
  Star,
  Archive,
  Plus,
  ArrowUpRight,
  ArrowLeft,
  MessageCircle,
  Check,
  CheckCheck,
  X,
  MoreHorizontal,
  Upload,
  CornerDownRight,
  Send,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Columns2,
  MapPin,
  Loader2,
  PanelLeftClose,
  Menu,
  Pencil,
  RotateCcw,
} from "lucide-react";
import type { User, Detail, Status } from "@/lib/types";
import { statusLabels } from "@/lib/types";
import {
  Avatar,
  Badge,
  Empty,
  ActivityList,
  date,
  relative,
} from "@/components/studio-ui";
type Props = {
  detail: Detail;
  user: User;
  busy: boolean;
  mutate: (id: string, body: unknown, message?: string) => Promise<boolean>;
  upload: (file: File, id: string) => Promise<{ id: string }>;
  refresh: () => Promise<void>;
  notify: (s: string, e?: boolean) => void;
  onBack: () => void;
  onShare: () => void;
  onEdit: () => void;
};
export default function Review({
  detail: d,
  user,
  busy,
  mutate,
  upload,
  refresh,
  notify,
  onBack,
  onShare,
  onEdit,
}: Props) {
  const [versionId, setVersionId] = useState(d.versions[0]?.id ?? ""),
    [tab, setTab] = useState("comments"),
    [filter, setFilter] = useState("open"),
    [pinMode, setPinMode] = useState(false),
    [pin, setPin] = useState<{ x: number; y: number } | null>(null),
    [body, setBody] = useState(""),
    [selectedComment, setSelectedComment] = useState<string | null>(null),
    [reply, setReply] = useState(""),
    [zoom, setZoom] = useState(1),
    [compare, setCompare] = useState(false),
    [leftVersion, setLeftVersion] = useState(""),
    [uploading, setUploading] = useState(false),
    [menu, setMenu] = useState(false),
    [versionPanel, setVersionPanel] = useState(true);
  const input = useRef<HTMLInputElement>(null),
    commentInput = useRef<HTMLTextAreaElement>(null);
  const current = d.versions.find((v) => v.id === versionId) || d.versions[0];
  const older =
    d.versions.find((v) => v.id === leftVersion && v.id !== current?.id) ||
    d.versions.find((v) => v.id !== current?.id);
  const canEdit = d.role !== "reviewer",
    isLatest = current?.id === d.versions[0]?.id;
  const comments = d.comments.filter((c) => c.version_id === current?.id),
    roots = comments.filter((c) => !c.parent_id),
    shown = roots.filter(
      (c) =>
        filter === "all" ||
        (filter === "resolved" ? !!c.resolved : !c.resolved),
    ),
    openCount = roots.filter((c) => !c.resolved).length;
  useEffect(() => {
    if (!versionId && d.versions.length) setVersionId(d.versions[0].id);
  }, [d.versions, versionId]);
  const changeVersion = (id: string) => {
    setVersionId(id);
    setPin(null);
    setSelectedComment(null);
    setZoom(1);
  };
  async function addComment(e: FormEvent) {
    e.preventDefault();
    if (!current || !body.trim()) return;
    if (
      await mutate(
        d.project.id,
        { op: "comment", versionId: current.id, body, ...(pin || {}) },
        "Feedback added.",
      )
    ) {
      setBody("");
      setPin(null);
      setPinMode(false);
    }
  }
  async function addReply(id: string) {
    if (!current || !reply.trim()) return;
    if (
      await mutate(d.project.id, {
        op: "comment",
        versionId: current.id,
        parentId: id,
        body: reply,
      })
    )
      setReply("");
  }
  function placePin(e: ReactMouseEvent<HTMLDivElement>) {
    if (!pinMode || !current || compare) return;
    const r = e.currentTarget.getBoundingClientRect();
    setPin({
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    });
    setTab("comments");
    setTimeout(() => commentInput.current?.focus(), 0);
  }
  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const result = await upload(file, d.project.id);
      await refresh();
      setVersionId(result.id);
      setCompare(false);
      notify("New version uploaded.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setUploading(false);
    }
  }
  function statusChange(status: Status) {
    if (current)
      mutate(
        d.project.id,
        { op: "status", versionId: current.id, status },
        {
          draft: "Returned to draft.",
          in_review: "Ready for feedback.",
          changes_requested: "Changes requested.",
          approved: "Version approved.",
        }[status],
      );
  }
  return (
    <>
      <div className="review-header">
        <div className="review-title">
          <button
            className="icon-btn back-button"
            aria-label="Back to projects"
            onClick={onBack}
          >
            <ArrowLeft size={19} />
          </button>
          <div>
            <div className="review-name">
              <h1>{d.project.name}</h1>
              {d.project.sample === 1 && (
                <span className="sample-tag">Sample project</span>
              )}
            </div>
            <p>
              {d.project.category}
              <span>·</span>
              {d.role.charAt(0).toUpperCase() + d.role.slice(1)} access
            </p>
          </div>
        </div>
        <div className="review-actions">
          <button className="button secondary" onClick={onShare}>
            <Users size={16} /> Share
          </button>
          {canEdit && (
            <button
              className="button primary"
              disabled={uploading}
              onClick={() => input.current?.click()}
            >
              {uploading ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Upload size={16} />
              )}{" "}
              Upload version
            </button>
          )}
          <div className="menu-wrap">
            <button
              className="icon-btn"
              aria-label="Project options"
              onClick={() => setMenu(!menu)}
            >
              <MoreHorizontal size={21} />
            </button>
            {menu && (
              <div className="dropdown">
                <button
                  onClick={() => {
                    setMenu(false);
                    onEdit();
                  }}
                  disabled={!canEdit}
                >
                  <Pencil size={15} /> Edit details
                </button>
                <button
                  onClick={() => {
                    setMenu(false);
                    mutate(d.project.id, {
                      op: "star",
                      value: !d.project.starred,
                    });
                  }}
                >
                  <Star size={15} />{" "}
                  {d.project.starred ? "Unstar project" : "Star project"}
                </button>
                {d.role === "owner" && (
                  <button
                    onClick={() => {
                      setMenu(false);
                      mutate(
                        d.project.id,
                        { op: "archive", value: !d.project.archived },
                        d.project.archived
                          ? "Project restored."
                          : "Project archived.",
                      );
                    }}
                  >
                    <Archive size={15} />{" "}
                    {d.project.archived ? "Restore project" : "Archive project"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <input
          ref={input}
          className="sr-only"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
            e.target.value = "";
          }}
        />
      </div>
      <div className="review-workspace">
        {versionPanel && (
          <aside className="versions-panel">
            <div className="versions-label">
              <span>VERSIONS</span>
              <button
                className="icon-btn"
                aria-label="Hide versions"
                onClick={() => setVersionPanel(false)}
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
            {d.versions.map((v) => (
              <button
                key={v.id}
                className={
                  "version-card " + (v.id === current?.id ? "selected" : "")
                }
                onClick={() => changeVersion(v.id)}
              >
                <span className={"version-thumb color-" + d.project.color}>
                  <img
                    src={"/api/assets/" + v.id}
                    alt={"Version " + v.number}
                  />
                </span>
                <span className="version-card-info">
                  <strong>Version {v.number}</strong>
                  <small>{date(v.created_at)}</small>
                </span>
                <span
                  className={"version-status " + v.status}
                  title={statusLabels[v.status]}
                />
              </button>
            ))}
            {canEdit && (
              <button
                className="add-version"
                disabled={uploading}
                onClick={() => input.current?.click()}
              >
                <Plus size={16} /> Add version
              </button>
            )}
            <div className="version-note">
              <Flower2 size={23} strokeWidth={1.1} />
              <p>Every version has its own conversations.</p>
            </div>
          </aside>
        )}
        <div className="canvas-column">
          <div className="canvas-toolbar">
            <div>
              {!versionPanel && (
                <button
                  className="icon-btn"
                  aria-label="Show versions"
                  onClick={() => setVersionPanel(true)}
                >
                  <Menu size={17} />
                </button>
              )}
              <span>
                {current ? "Version " + current.number : "Your design"}
              </span>
              {current && <Badge status={current.status} />}
            </div>
            <div>
              <button
                className={"tool-button " + (pinMode ? "active" : "")}
                disabled={!current || compare}
                onClick={() => {
                  setPinMode(!pinMode);
                  setPin(null);
                }}
              >
                <MapPin size={15} />
                <span>Add pin</span>
              </button>
              <button
                className={"tool-button " + (compare ? "active" : "")}
                disabled={d.versions.length < 2}
                onClick={() => {
                  setCompare(!compare);
                  setPinMode(false);
                  setPin(null);
                }}
              >
                <Columns2 size={16} />
                <span>Compare</span>
              </button>
            </div>
          </div>
          {current ? (
            <div className={"canvas-viewport " + (pinMode ? "pin-cursor" : "")}>
              <div
                className={compare ? "comparison" : "single-design"}
                style={compare ? {} : { width: zoom * 100 + "%" }}
              >
                {compare && older && (
                  <div className="compare-image">
                    <div className="compare-label">
                      <select
                        aria-label="Compare version"
                        value={older.id}
                        onChange={(e) => setLeftVersion(e.target.value)}
                      >
                        {d.versions
                          .filter((v) => v.id !== current.id)
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              Version {v.number}
                            </option>
                          ))}
                      </select>
                      <span>{statusLabels[older.status]}</span>
                    </div>
                    <img
                      src={"/api/assets/" + older.id}
                      alt={"Version " + older.number}
                    />
                  </div>
                )}
                <div className={compare ? "compare-image" : "design-holder"}>
                  {compare && (
                    <div className="compare-label">
                      <span>Version {current.number}</span>
                      <span>Selected</span>
                    </div>
                  )}
                  <div className="image-surface" onClick={placePin}>
                    <img
                      className="main-design"
                      src={"/api/assets/" + current.id}
                      alt={current.file_name}
                      draggable={false}
                    />
                    {!compare &&
                      roots.map(
                        (c, i) =>
                          c.x !== null &&
                          c.y !== null && (
                            <button
                              key={c.id}
                              className={
                                "comment-pin " +
                                (c.resolved ? "resolved " : "") +
                                (selectedComment === c.id ? "selected" : "")
                              }
                              style={{
                                left: c.x * 100 + "%",
                                top: c.y * 100 + "%",
                              }}
                              aria-label={"Feedback " + (i + 1) + ": " + c.body}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedComment(c.id);
                                setTab("comments");
                                setFilter(c.resolved ? "resolved" : "open");
                                setTimeout(
                                  () =>
                                    document
                                      .getElementById("comment-" + c.id)
                                      ?.scrollIntoView({
                                        behavior: "smooth",
                                        block: "nearest",
                                      }),
                                  50,
                                );
                              }}
                            >
                              {c.resolved ? <Check size={14} /> : i + 1}
                            </button>
                          ),
                      )}
                    {pin && (
                      <span
                        className="comment-pin new-pin"
                        style={{
                          left: pin.x * 100 + "%",
                          top: pin.y * 100 + "%",
                        }}
                      >
                        <Plus size={15} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {pinMode && (
                <div className="pin-instruction">
                  Click a spot on the design, then leave your feedback.
                  <button
                    aria-label="Stop adding a pin"
                    onClick={() => {
                      setPinMode(false);
                      setPin(null);
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="canvas-empty">
              <Empty
                title="Let’s see what you’re making"
                text={
                  canEdit
                    ? "Upload your first design to start a conversation."
                    : "Your editor will add the first design here."
                }
              >
                {canEdit && (
                  <button
                    className="button primary"
                    disabled={uploading}
                    onClick={() => input.current?.click()}
                  >
                    <Upload size={16} /> Upload a design
                  </button>
                )}
              </Empty>
            </div>
          )}
          <div className="canvas-bottom">
            <span>
              {compare
                ? "Side by side comparison"
                : current?.file_name || "PNG, JPG, WebP, or GIF"}
            </span>
            {current && !compare && (
              <div>
                <button
                  className="icon-btn"
                  aria-label="Zoom out"
                  onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
                >
                  <ZoomOut size={16} />
                </button>
                <span className="zoom-label">{Math.round(zoom * 100)}%</span>
                <button
                  className="icon-btn"
                  aria-label="Zoom in"
                  onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  className="icon-btn"
                  aria-label="Fit design to canvas"
                  onClick={() => setZoom(1)}
                >
                  <Maximize2 size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
        <aside className="feedback-panel">
          <div className="feedback-tabs">
            <button
              className={tab === "comments" ? "active" : ""}
              onClick={() => setTab("comments")}
            >
              Feedback <span>{roots.length}</span>
            </button>
            <button
              className={tab === "activity" ? "active" : ""}
              onClick={() => setTab("activity")}
            >
              Activity
            </button>
          </div>
          {tab === "comments" ? (
            <>
              <div className="feedback-controls">
                <span>
                  {openCount} open{" "}
                  {openCount === 1 ? "conversation" : "conversations"}
                </span>
                <select
                  aria-label="Filter feedback"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="open">Open</option>
                  <option value="resolved">Resolved</option>
                  <option value="all">All</option>
                </select>
              </div>
              <div className="comment-list">
                {shown.length ? (
                  shown.map((c) => (
                    <div
                      id={"comment-" + c.id}
                      key={c.id}
                      className={
                        "comment-card " +
                        (selectedComment === c.id ? "highlighted" : "")
                      }
                    >
                      <div className="comment-top">
                        <Avatar name={c.author_name} />
                        <div>
                          <strong>
                            {c.author_name === user.displayName
                              ? "You"
                              : c.author_name}
                          </strong>
                          <small>{relative(c.created_at)}</small>
                        </div>
                        {c.x !== null && (
                          <span className="pin-number">
                            {roots.indexOf(c) + 1}
                          </span>
                        )}
                        {(canEdit || c.author_id === user.userId) && (
                          <button
                            className={
                              "resolve-btn " + (c.resolved ? "done" : "")
                            }
                            title={
                              c.resolved
                                ? "Reopen conversation"
                                : "Resolve conversation"
                            }
                            aria-label={
                              c.resolved
                                ? "Reopen conversation"
                                : "Resolve conversation"
                            }
                            disabled={busy}
                            onClick={() =>
                              mutate(
                                d.project.id,
                                {
                                  op: "resolve",
                                  versionId: current.id,
                                  commentId: c.id,
                                  value: !c.resolved,
                                },
                                c.resolved
                                  ? "Conversation reopened."
                                  : "Conversation resolved.",
                              )
                            }
                          >
                            <Check size={15} />
                          </button>
                        )}
                      </div>
                      <p>{c.body}</p>
                      {comments
                        .filter((r) => r.parent_id === c.id)
                        .map((r) => (
                          <div key={r.id} className="reply">
                            <CornerDownRight size={13} />
                            <div>
                              <strong>
                                {r.author_name === user.displayName
                                  ? "You"
                                  : r.author_name}
                              </strong>
                              <p>{r.body}</p>
                              <small>{relative(r.created_at)}</small>
                            </div>
                          </div>
                        ))}
                      {selectedComment === c.id ? (
                        <form
                          className="reply-form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            addReply(c.id);
                          }}
                        >
                          <input
                            autoFocus
                            aria-label="Reply to feedback"
                            placeholder="Add a reply"
                            value={reply}
                            onChange={(e) => setReply(e.target.value)}
                            maxLength={3000}
                          />
                          <button
                            className="icon-btn"
                            disabled={busy || !reply.trim()}
                            aria-label="Send reply"
                          >
                            <Send size={14} />
                          </button>
                        </form>
                      ) : (
                        <button
                          className="reply-link"
                          onClick={() => {
                            setSelectedComment(c.id);
                            setReply("");
                          }}
                        >
                          Reply
                          {comments.filter((r) => r.parent_id === c.id).length
                            ? " · " +
                              comments.filter((r) => r.parent_id === c.id)
                                .length
                            : ""}
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="no-comments">
                    <MessageCircle size={28} strokeWidth={1.2} />
                    <h3>
                      {filter === "resolved"
                        ? "Nothing resolved yet"
                        : roots.length
                          ? "All caught up"
                          : "Start a conversation"}
                    </h3>
                    <p>
                      {filter === "resolved"
                        ? "Resolved feedback will appear here."
                        : "Pin a thought on the design, or leave a note below."}
                    </p>
                  </div>
                )}
              </div>
              <form className="comment-composer" onSubmit={addComment}>
                {pin && (
                  <div className="pin-composer-label">
                    <MapPin size={13} /> Pinned to the design
                    <button
                      type="button"
                      aria-label="Remove comment pin"
                      onClick={() => setPin(null)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
                <textarea
                  ref={commentInput}
                  placeholder={
                    current
                      ? "Leave your feedback..."
                      : "Upload a design to add feedback"
                  }
                  aria-label="Feedback message"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={3000}
                  disabled={!current}
                  rows={3}
                />
                <div>
                  <span>
                    <Avatar name={user.displayName} />
                    <small>Visible to the project</small>
                  </span>
                  <button
                    className="send-button"
                    aria-label="Post feedback"
                    disabled={!current || !body.trim() || busy}
                  >
                    <ArrowUpRight size={18} />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="review-activity">
              <ActivityList items={d.activity} />
            </div>
          )}
          {current && (
            <div className={"approval-box " + current.status}>
              <div>
                <span className="approval-icon">
                  {current.status === "approved" ? (
                    <CheckCheck size={20} />
                  ) : (
                    <Flower2 size={21} strokeWidth={1.4} />
                  )}
                </span>
                <strong>
                  {current.status === "approved"
                    ? "Looking good. Approved."
                    : current.status === "in_review"
                      ? "Ready for a closer look"
                      : current.status === "changes_requested"
                        ? "A few finishing touches"
                        : "Ready when you are"}
                </strong>
              </div>
              <p>
                {!isLatest
                  ? "You’re viewing an earlier version."
                  : current.status === "approved"
                    ? "This version has the green light."
                    : current.status === "in_review"
                      ? "Leave your feedback or make a review decision."
                      : current.status === "changes_requested"
                        ? "Upload a revision or request another review."
                        : "Request a review when your design is ready."}
              </p>
              {isLatest && (
                <>
                  {current.status === "in_review" && d.role !== "editor" ? (
                    <div className="approval-buttons">
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => statusChange("changes_requested")}
                      >
                        Request changes
                      </button>
                      <button
                        className="button sage-button"
                        disabled={busy}
                        onClick={() => statusChange("approved")}
                      >
                        <Check size={15} /> Approve
                      </button>
                    </div>
                  ) : canEdit &&
                    current.status !== "in_review" &&
                    current.status !== "approved" ? (
                    <button
                      className="button primary full-width"
                      disabled={busy}
                      onClick={() => statusChange("in_review")}
                    >
                      Request review <ArrowUpRight size={15} />
                    </button>
                  ) : current.status === "approved" && canEdit ? (
                    <button
                      className="reopen-review"
                      disabled={busy}
                      onClick={() => statusChange("draft")}
                    >
                      <RotateCcw size={12} /> Reopen as draft
                    </button>
                  ) : (
                    <span className="waiting-review">
                      Waiting for a review decision
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
