"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Flower2,
  LayoutGrid,
  Users,
  Star,
  Clock3,
  Archive,
  Search,
  Plus,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Check,
  X,
  Grid2X2,
  List,
  LogOut,
  Loader2,
  ArrowDownUp,
  FolderOpen,
  Menu,
  CheckCircle2,
  Info,
} from "lucide-react";
import type { User, Project, Detail, Activity } from "@/lib/types";
import {
  Avatar,
  Badge,
  Empty,
  ActivityList,
  NewProject,
  Share,
  EditProject,
  request,
  post,
  relative,
  categories,
} from "@/components/studio-ui";
import Review from "./Review";
import { projectAction } from "./lib/api";
import { useAuth } from "./lib/auth";
import { useNavigate, useLocation } from "react-router-dom";
type View = "all" | "shared" | "starred" | "activity" | "archive";
export default function Studio({ user }: { user: User }) {
  const { logout } = useAuth();
  const navigate = useNavigate(),
    route = useLocation();
  const [projects, setProjects] = useState<Project[]>([]),
    [activity, setActivity] = useState<Activity[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [view, setView] = useState<View>("all"),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [category, setCategory] = useState("all"),
    [sort, setSort] = useState("recent"),
    [list, setList] = useState(false);
  const [selected, setSelected] = useState<string | null>(null),
    [detail, setDetail] = useState<Detail | null>(null),
    [detailError, setDetailError] = useState("");
  const [modal, setModal] = useState<"new" | "share" | "edit" | null>(null),
    [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false),
    [account, setAccount] = useState(false),
    [welcome, setWelcome] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(
    () => setSelected(new URLSearchParams(route.search).get("project")),
    [route.search],
  );

  const notify = useCallback(
    (text: string, error = false) => setNotice({ text, error }),
    [],
  );
  const refresh = useCallback(async () => {
    const data = await request<{ projects: Project[]; activity: Activity[] }>(
      "/api/studio",
    );
    setProjects(data.projects);
    setActivity(data.activity);
  }, []);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await post("/api/studio", { op: "initialize" });
        if (active) await refresh();
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    const key = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      active = false;
      window.removeEventListener("keydown", key);
    };
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5500);
    return () => clearTimeout(t);
  }, [notice]);
  const reloadDetail = useCallback(async () => {
    if (!selected) return;
    const data = await request<Detail>("/api/projects/" + selected);
    setDetail(data);
    return data;
  }, [selected]);
  useEffect(() => {
    setDetail(null);
    setDetailError("");
    if (!selected) return;
    const controller = new AbortController();
    request<Detail>("/api/projects/" + selected, { signal: controller.signal })
      .then(setDetail)
      .catch((e) => {
        if (e.name !== "AbortError") setDetailError(e.message);
      });
    return () => controller.abort();
  }, [selected]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        refresh().catch(() => {});
        if (selected) reloadDetail().catch(() => {});
      }
    }, 20000);
    return () => clearInterval(timer);
  }, [refresh, reloadDetail, selected]);
  function open(id: string | null) {
    setSelected(id);
    setQuery("");
    setMobile(false);
    const u = new URL(location.href);
    if (id) u.searchParams.set("project", id);
    else u.searchParams.delete("project");
    navigate("/" + u.search);
  }
  function nav(v: View) {
    setView(v);
    setStatus("all");
    setCategory("all");
    setQuery("");
    open(null);
  }
  async function mutate(id: string, body: unknown, message?: string) {
    setBusy(true);
    try {
      await projectAction(id, body);
      await Promise.all([
        refresh(),
        id === selected ? reloadDetail() : Promise.resolve(),
      ]);
      if (message) notify(message);
      return true;
    } catch (e) {
      notify((e as Error).message, true);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File, id: string) {
    if (file.size > 12 * 1024 * 1024)
      throw new Error("Please choose an image smaller than 12 MB.");
    const data = new FormData();
    data.set("file", file);
    return request<{ id: string }>("/api/projects/" + id + "/upload", {
      method: "POST",
      body: data,
    });
  }
  const active = projects.filter((p) => !p.archived),
    base = projects
      .filter((p) => (view === "archive" ? !!p.archived : !p.archived))
      .filter((p) => view !== "shared" || p.owner_id !== user.userId)
      .filter((p) => view !== "starred" || p.starred);
  const filtered = base
    .filter(
      (p) =>
        (status === "all" || p.status === status) &&
        (category === "all" || p.category === category) &&
        (p.name + " " + p.description + " " + p.category)
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "oldest"
          ? a.created_at - b.created_at
          : b.updated_at - a.updated_at,
    );
  const navs: [View, typeof LayoutGrid, string, number?][] = [
    ["all", LayoutGrid, "All projects", active.length],
    ["shared", Users, "Shared with me"],
    ["starred", Star, "Starred", active.filter((p) => p.starred).length],
    ["activity", Clock3, "Activity"],
    ["archive", Archive, "Archive"],
  ];
  return (
    <div className="app-shell">
      {mobile && (
        <div className="mobile-scrim" onClick={() => setMobile(false)} />
      )}
      <aside className={"sidebar " + (mobile ? "is-open" : "")}>
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            nav("all");
          }}
        >
          <span className="brand-mark">
            <Flower2 size={30} strokeWidth={1.5} />
          </span>
          <span>
            reviewroom<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-card">
          <span className="workspace-icon">
            <Flower2 size={21} />
          </span>
          <div>
            <strong>Personal studio</strong>
            <small>Your creative workspace</small>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navs.map(([key, Icon, label, count]) => (
            <button
              key={key}
              className={
                "nav-item " + (view === key && !selected ? "active" : "")
              }
              onClick={() => nav(key)}
            >
              <Icon size={18} strokeWidth={1.6} />
              <span>{label}</span>
              {count != null && <span className="nav-count">{count}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-tape" />
            <Flower2 size={25} strokeWidth={1.2} />
            <h3>Room for your next idea.</h3>
            <p>Keep your designs and feedback in one thoughtful space.</p>
            <button onClick={() => setModal("new")}>
              Start a project <ArrowUpRight size={15} />
            </button>
          </div>
          <button className="profile" onClick={() => setAccount(!account)}>
            <Avatar name={user.displayName} />
            <span>
              <strong>
                {user.displayName.includes("@")
                  ? user.email.split("@")[0]
                  : user.displayName}
              </strong>
              <small>Personal workspace</small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {selected
                ? "Project review"
                : {
                    all: "All projects",
                    shared: "Shared with me",
                    starred: "Starred",
                    activity: "Activity",
                    archive: "Archive",
                  }[view]}
            </strong>
          </div>
          <div className="top-actions">
            <div className="search-field">
              <Search size={16} />
              <input
                ref={searchRef}
                aria-label="Search projects"
                placeholder="Search your projects"
                value={query}
                onChange={(e) => {
                  if (selected) open(null);
                  setQuery(e.target.value);
                }}
              />
              <kbd>/</kbd>
            </div>
            <span className="top-divider" />
            <button
              className="avatar-button"
              aria-label="Account menu"
              onClick={() => setAccount(!account)}
            >
              <Avatar name={user.displayName} />
            </button>
          </div>
        </header>
        {selected ? (
          <div className="review-wrap">
            {detail ? (
              <Review
                key={detail.project.id}
                detail={detail}
                user={user}
                busy={busy}
                mutate={mutate}
                upload={upload}
                refresh={async () => {
                  await Promise.all([refresh(), reloadDetail()]);
                }}
                notify={notify}
                onBack={() => open(null)}
                onShare={() => setModal("share")}
                onEdit={() => setModal("edit")}
              />
            ) : detailError ? (
              <Empty title="We couldn’t open this project" text={detailError}>
                <button className="button primary" onClick={() => open(null)}>
                  Back to your studio
                </button>
              </Empty>
            ) : (
              <div className="loading">
                <Loader2 className="spin" size={24} />
                <p>Opening your project</p>
              </div>
            )}
          </div>
        ) : (
          <main className="dashboard">
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  <Flower2 size={15} /> YOUR STUDIO
                </div>
                <h1>
                  {view === "all" ? (
                    <>
                      Your creative space<span className="rose-dot">.</span>
                    </>
                  ) : (
                    {
                      shared: "Better, together.",
                      starred: "A few favorites.",
                      activity: "What’s happening.",
                      archive: "Tucked away.",
                    }[view]
                  )}
                </h1>
                <p>
                  {
                    {
                      all: "Share designs, gather feedback, and bring it all together.",
                      shared: "The projects you have been invited to work on.",
                      starred: "Your favorite projects, kept close.",
                      activity: "A little history of the work in your studio.",
                      archive: "Finished for now. Ready whenever you are.",
                    }[view]
                  }
                </p>
              </div>
              <button
                className="button primary"
                onClick={() => setModal("new")}
              >
                <Plus size={17} /> New project
              </button>
            </div>
            {view === "all" && (
              <>
                <div className="summary-row">
                  <div>
                    <span className="summary-icon rose">
                      <FolderOpen size={19} />
                    </span>
                    <span>
                      <strong>{active.length}</strong>
                      <small>Projects in your studio</small>
                    </span>
                  </div>
                  <div>
                    <span className="summary-icon sage">
                      <MessageCircle size={19} />
                    </span>
                    <span>
                      <strong>
                        {active.reduce((n, p) => n + p.open_comments, 0)}
                      </strong>
                      <small>Open conversations</small>
                    </span>
                  </div>
                  <div>
                    <span className="summary-icon lavender">
                      <CheckCircle2 size={19} />
                    </span>
                    <span>
                      <strong>
                        {active.filter((p) => p.status === "approved").length}
                      </strong>
                      <small>Approved and ready</small>
                    </span>
                  </div>
                  <span className="summary-sketch">
                    <Flower2 size={52} strokeWidth={0.9} />
                    <i>made with care</i>
                  </span>
                </div>
                {welcome && active.some((p) => p.sample) && (
                  <div className="welcome-note">
                    <Info size={16} />
                    <p>
                      A sample studio to get you started.{" "}
                      <button onClick={() => setModal("new")}>
                        Add your own project
                      </button>{" "}
                      whenever you’re ready.
                    </p>
                    <button
                      className="icon-btn"
                      aria-label="Dismiss sample note"
                      onClick={() => setWelcome(false)}
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}
              </>
            )}
            {view === "activity" ? (
              <div className="activity-page">
                <div className="section-title">
                  <h2>Studio activity</h2>
                  <span>Latest updates</span>
                </div>
                <ActivityList items={activity} onOpen={open} />
              </div>
            ) : (
              <>
                <div className="board-heading">
                  <div className="board-title">
                    <h2>
                      {view === "archive"
                        ? "Archived projects"
                        : "Project board"}
                    </h2>
                    <span className="count-pill">{base.length}</span>
                  </div>
                  <div className="board-options">
                    <select
                      aria-label="Filter by category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="all">All categories</option>
                      {categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <div className="sort-select">
                      <ArrowDownUp size={14} />
                      <select
                        aria-label="Sort projects"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="recent">Last updated</option>
                        <option value="name">Name A to Z</option>
                        <option value="oldest">Oldest first</option>
                      </select>
                    </div>
                    <div className="view-switch">
                      <button
                        aria-label="Grid view"
                        aria-pressed={!list}
                        className={!list ? "chosen" : ""}
                        onClick={() => setList(false)}
                      >
                        <Grid2X2 size={16} />
                      </button>
                      <button
                        aria-label="List view"
                        aria-pressed={list}
                        className={list ? "chosen" : ""}
                        onClick={() => setList(true)}
                      >
                        <List size={17} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="tabs">
                  {[
                    ["all", "All projects"],
                    ["in_review", "In review"],
                    ["changes_requested", "Needs changes"],
                    ["approved", "Approved"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      className={status === key ? "selected" : ""}
                      onClick={() => setStatus(key)}
                    >
                      {label}
                      {key === "in_review" && (
                        <span>
                          {base.filter((p) => p.status === key).length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {loading ? (
                  <div className="loading">
                    <Loader2 className="spin" size={23} />
                    <p>Getting your studio ready</p>
                  </div>
                ) : error ? (
                  <Empty title="Your studio needs a moment" text={error}>
                    <button
                      className="button secondary"
                      onClick={() => {
                        setError("");
                        setLoading(true);
                        post("/api/studio", { op: "initialize" })
                          .then(refresh)
                          .catch((e) => setError(e.message))
                          .finally(() => setLoading(false));
                      }}
                    >
                      Try again
                    </button>
                  </Empty>
                ) : filtered.length ? (
                  <div className={list ? "project-list" : "project-grid"}>
                    {filtered.map((p, i) => (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        index={i}
                        onOpen={() => open(p.id)}
                        onStar={() =>
                          mutate(p.id, { op: "star", value: !p.starred })
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <Empty
                    title={
                      query
                        ? "Nothing here just yet"
                        : "Make room for something new"
                    }
                    text={
                      query
                        ? "Try a different name or change your filters."
                        : view === "shared"
                          ? "Projects shared with your email address will appear here."
                          : view === "starred"
                            ? "Tap the star on a project to keep it here."
                            : "Create a project and give your next idea a home."
                    }
                  >
                    {!query && view !== "starred" && view !== "shared" && (
                      <button
                        className="button secondary"
                        onClick={() => setModal("new")}
                      >
                        <Plus size={16} /> Create a project
                      </button>
                    )}
                  </Empty>
                )}
                <div className="board-footer">
                  <Flower2 size={15} strokeWidth={1.3} />
                  <span>A little more organized. A little more inspired.</span>
                  <span className="footer-right">
                    {filtered.length}{" "}
                    {filtered.length === 1 ? "project" : "projects"}
                  </span>
                </div>
              </>
            )}
          </main>
        )}
      </div>
      {account && (
        <div className="account-popover">
          <span>{user.email}</span>
          <button
            className="signout-button"
            onClick={() => logout().catch((e) => notify(e.message, true))}
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
      {notice && (
        <div
          className={"toast " + (notice.error ? "error" : "")}
          role={notice.error ? "alert" : "status"}
        >
          {notice.error ? <Info size={17} /> : <Check size={17} />}
          <span>{notice.text}</span>
          <button
            className="icon-btn"
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {modal === "new" && (
        <NewProject
          onClose={() => setModal(null)}
          onSubmit={async (values) => {
            setBusy(true);
            try {
              const created = await post<{ id: string }>("/api/projects", {
                op: "create",
                ...values,
                file: undefined,
              });
              setModal(null);
              open(created.id);
              let uploadFailed = false;
              if (values.file) {
                try {
                  await upload(values.file, created.id);
                } catch (e) {
                  uploadFailed = true;
                  notify("Project created. " + (e as Error).message, true);
                }
              }
              await refresh();
              await request<Detail>("/api/projects/" + created.id).then(
                setDetail,
              );
              if (!uploadFailed) notify("Your project is ready.");
            } catch (e) {
              notify((e as Error).message, true);
            } finally {
              setBusy(false);
            }
          }}
          busy={busy}
        />
      )}
      {modal === "share" && detail && (
        <Share
          detail={detail}
          user={user}
          busy={busy}
          onClose={() => setModal(null)}
          onSave={(email, role) => {
            mutate(
              detail.project.id,
              { op: "member", email, role },
              "Access added. Share the project link with your teammate.",
            );
          }}
          onRemove={(email) => {
            mutate(
              detail.project.id,
              { op: "remove-member", email },
              "Access removed.",
            );
          }}
          notify={notify}
        />
      )}
      {modal === "edit" && detail && (
        <EditProject
          detail={detail}
          busy={busy}
          onClose={() => setModal(null)}
          onSave={async (name, description) => {
            if (
              await mutate(
                detail.project.id,
                { op: "rename", name, description },
                "Project details updated.",
              )
            )
              setModal(null);
          }}
        />
      )}
    </div>
  );
}
function ProjectCard({
  project: p,
  index,
  onOpen,
  onStar,
}: {
  project: Project;
  index: number;
  onOpen: () => void;
  onStar: () => void;
}) {
  return (
    <article
      className={"project-card color-" + p.color}
      style={{ animationDelay: index * 45 + "ms" }}
    >
      <div className="project-cover">
        <button
          className="cover-link"
          onClick={onOpen}
          aria-label={"Open " + p.name}
        >
          {p.cover ? (
            <img
              src={"/api/assets/" + p.cover}
              alt={p.name + " design"}
              loading="lazy"
            />
          ) : (
            <div className="blank-cover">
              <Flower2 size={65} strokeWidth={1} />
              <span>Your next idea goes here</span>
            </div>
          )}
        </button>
        <span className="sample-label">{p.sample ? "Sample" : p.category}</span>
        <button
          className={"star-button " + (p.starred ? "is-starred" : "")}
          aria-label={(p.starred ? "Unstar " : "Star ") + p.name}
          onClick={onStar}
        >
          <Star size={16} fill={p.starred ? "currentColor" : "none"} />
        </button>
        <span className="cover-version">
          {p.version_count ? "Version " + p.version_count : "No files yet"}
        </span>
      </div>
      <div className="project-info">
        <div className="project-title-row">
          <button onClick={onOpen}>{p.name}</button>
          <ArrowUpRight size={17} />
        </div>
        <p>{p.description || "A fresh space for your next design."}</p>
        <div className="project-meta">
          <span>{p.category}</span>
          <Badge status={p.status} />
        </div>
      </div>
      <div className="project-card-footer">
        <span className="project-people">
          <span className="mini-avatar">{p.name.slice(0, 1)}</span>
          <span>
            {p.member_count === 1 ? "Just you" : p.member_count + " members"}
          </span>
        </span>
        <span className="card-comments">
          <MessageCircle size={14} />
          {p.open_comments}
        </span>
        <span className="updated">{relative(p.updated_at)}</span>
      </div>
    </article>
  );
}
