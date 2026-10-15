export type User = { userId: string; displayName: string; email: string };
export type Status = "draft" | "in_review" | "changes_requested" | "approved";
export type Project = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  category: string;
  color: string;
  archived: number;
  sample: number;
  created_at: number;
  updated_at: number;
  cover: string | null;
  status: Status;
  version_count: number;
  open_comments: number;
  starred: number;
  member_count: number;
};
export type Version = {
  id: string;
  project_id: string;
  number: number;
  file_key: string;
  file_name: string;
  mime: string;
  status: Status;
  created_at: number;
};
export type Comment = {
  id: string;
  version_id: string;
  author_id: string;
  author_name: string;
  body: string;
  x: number | null;
  y: number | null;
  parent_id: string | null;
  resolved: number;
  created_at: number;
};
export type Member = { id: string; email: string; role: "editor" | "reviewer" };
export type Activity = {
  id: string;
  project_id: string;
  project_name?: string;
  actor: string;
  body: string;
  created_at: number;
};
export type Detail = {
  project: Project;
  versions: Version[];
  comments: Comment[];
  members: Member[];
  activity: Activity[];
  role: "owner" | "editor" | "reviewer";
};
export const statusLabels: Record<Status, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
};
