"use client";
import { useState, useEffect, useRef } from "react";
import {
  Flower2,
  X,
  Plus,
  Check,
  ImagePlus,
  Link2,
  Copy,
  LogOut,
  ArrowUpRight,
  Clock3,
} from "lucide-react";
import type { User, Detail, Activity, Status } from "@/lib/types";
import { statusLabels } from "@/lib/types";
export const categories = [
  "Branding",
  "Web design",
  "Packaging",
  "Editorial",
  "Illustration",
  "Other",
];
export const initials = (s: string) =>
  s.includes("@")
    ? s.slice(0, 2).toUpperCase()
    : s
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
export const date = (n: number) =>
  new Date(n).toLocaleDateString("en", { month: "short", day: "numeric" });
export const relative = (n: number) => {
  const m = Math.floor((Date.now() - n) / 60000);
  return m < 1
    ? "Just now"
    : m < 60
      ? m + "m ago"
      : m < 1440
        ? Math.floor(m / 60) + "h ago"
        : date(n);
};
export async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    credentials:"include",
    ...options,
    headers:
      options.body instanceof FormData
        ? options.headers
        : { "Content-Type": "application/json", ...options.headers },
  });
  const data = (await res.json()) as T & { error?: string };
  if(res.status===401)window.dispatchEvent(new Event("reviewroom:unauthorized"));
  if (!res.ok)
    throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
export const post = <T,>(url: string, body: unknown) =>
  request<T>(url, { method: "POST", body: JSON.stringify(body) });
export function Avatar({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <span className={"avatar " + className} title={name}>
      {initials(name)}
    </span>
  );
}
export function Badge({ status }: { status: Status }) {
  return (
    <span className={"badge " + status}>
      <i />
      {statusLabels[status]}
    </span>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-top">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button
          className="icon-btn"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-flower">
        <Flower2 size={32} strokeWidth={1.2} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function ActivityList({
  items,
  onOpen,
}: {
  items: Activity[];
  onOpen?: (id: string) => void;
}) {
  return items.length ? (
    <div className="activity-list">
      {items.map((item) => (
        <div className="activity-item" key={item.id}>
          <span className="activity-dot">
            <Clock3 size={16} />
          </span>
          <div>
            <p>
              <strong>{item.actor}</strong>{" "}
              {item.body.charAt(0).toLowerCase() + item.body.slice(1)}
            </p>
            {item.project_name && (
              <button onClick={() => onOpen?.(item.project_id)}>
                {item.project_name} <ArrowUpRight size={12} />
              </button>
            )}
            <time>{relative(item.created_at)}</time>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <Empty
      title="A fresh start"
      text="Updates will appear as your project comes together."
    />
  );
}
export type NewValues = {
  name: string;
  description: string;
  category: string;
  color: string;
  file: File | null;
};
export function NewProject({
  onClose,
  onSubmit,
  busy,
}: {
  onClose: () => void;
  onSubmit: (v: NewValues) => Promise<void>;
  busy: boolean;
}) {
  const [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [category, setCategory] = useState("Branding"),
    [color, setColor] = useState("rose"),
    [file, setFile] = useState<File | null>(null);
  return (
    <Modal
      title="A new project"
      description="Give your idea a home. You can add more versions later."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name, description, category, color, file });
        }}
      >
        <label className="field-label">
          Project name
          <input
            autoFocus
            required
            maxLength={80}
            placeholder="e.g. Studio Bloom identity"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field-label">
          A little about it <span>Optional</span>
          <textarea
            maxLength={500}
            placeholder="What are you working on?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </label>
        <div className="form-row">
          <label className="field-label">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <fieldset className="color-field">
            <legend>Project color</legend>
            <div>
              {["rose", "sage", "lavender", "peach", "yellow"].map((c) => (
                <button
                  key={c}
                  type="button"
                  className={
                    "color-swatch " + c + (c === color ? " selected" : "")
                  }
                  aria-label={"Choose " + c}
                  aria-pressed={c === color}
                  onClick={() => setColor(c)}
                >
                  {c === color && <Check size={15} />}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <label className="upload-zone">
          <ImagePlus size={25} strokeWidth={1.4} />
          <strong>{file ? file.name : "Add your first design"}</strong>
          <span>PNG, JPG, WebP, or GIF, up to 12 MB</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <div className="modal-footer">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            <Plus size={16} /> {busy ? "Creating project" : "Create project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function EditProject({
  detail,
  busy,
  onClose,
  onSave,
}: {
  detail: Detail;
  busy: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
}) {
  const [name, setName] = useState(detail.project.name),
    [desc, setDesc] = useState(detail.project.description);
  return (
    <Modal title="Project details" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(name, desc);
        }}
      >
        <label className="field-label">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
          />
        </label>
        <label className="field-label">
          Description
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            maxLength={500}
            rows={4}
          />
        </label>
        <div className="modal-footer">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            Save changes
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function Share({
  detail,
  user,
  busy,
  onClose,
  onSave,
  onRemove,
  notify,
}: {
  detail: Detail;
  user: User;
  busy: boolean;
  onClose: () => void;
  onSave: (email: string, role: string) => void;
  onRemove: (email: string) => void;
  notify: (s: string, e?: boolean) => void;
}) {
  const [email, setEmail] = useState(""),
    [role, setRole] = useState("reviewer");
  return (
    <Modal
      title="Share your project"
      description="Give a teammate access, then send them the project link."
      onClose={onClose}
    >
      {detail.role === "owner" && (
        <form
          className="invite-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(email, role);
          }}
        >
          <input
            type="email"
            required
            placeholder="teammate@email.com"
            aria-label="Teammate email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            aria-label="Access role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="reviewer">Reviewer</option>
            <option value="editor">Editor</option>
          </select>
          <button className="button primary" disabled={busy}>
            Add
          </button>
        </form>
      )}
      <p className="share-help">
        Reviewers can comment and approve. Editors can upload and request
        reviews.
      </p>
      <div className="member-list">
        {detail.role === "owner" && (
          <div>
            <Avatar name={user.displayName} />
            <span>
              {user.email}
              <small>You</small>
            </span>
            <em>Owner</em>
          </div>
        )}
        {detail.members.map((m) => (
          <div key={m.id}>
            <Avatar name={m.email} />
            <span>{m.email}</span>
            <em>{m.role}</em>
            {detail.role === "owner" && (
              <button
                className="icon-btn"
                disabled={busy}
                aria-label={"Remove " + m.email}
                onClick={() => onRemove(m.email)}
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="share-link">
        <Link2 size={17} />
        <span>
          {typeof location !== "undefined"
            ? location.origin + "/?project=" + detail.project.id
            : "Project link"}
        </span>
        <button
          className="button secondary"
          onClick={() =>
            navigator.clipboard
              .writeText(location.origin + "/?project=" + detail.project.id)
              .then(() => notify("Project link copied."))
              .catch(() =>
                notify("Copy the link from your browser’s address bar.", true),
              )
          }
        >
          <Copy size={14} /> Copy
        </button>
      </div>
      <p className="share-footnote">
        No email is sent. Teammates need access to this site and must sign in
        with the email you added.
      </p>
    </Modal>
  );
}
