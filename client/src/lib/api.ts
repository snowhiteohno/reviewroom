export async function projectAction(id: string, input: unknown) {
  const body = input as Record<string, unknown>,
    base = "/api/projects/" + id;
  let url = base,
    method = "PATCH",
    payload = { ...body };
  switch (body.op) {
    case "star":
      url += "/favorite";
      method = "PUT";
      break;
    case "member":
      url += "/members";
      method = "POST";
      break;
    case "remove-member":
      url += "/members";
      method = "DELETE";
      break;
    case "comment":
      url += "/comments";
      method = "POST";
      break;
    case "resolve":
      url += "/comments/" + body.commentId;
      payload = { action: body.value ? "resolve" : "reopen" };
      break;
    case "feedback-state":
      url += "/comments/" + body.commentId;
      payload = { action: body.action, versionId: body.versionId };
      break;
    case "status":
      url += "/review";
      method = "POST";
      break;
    case "poll-create":
      url += "/polls";
      method = "POST";
      break;
    case "vote":
      url += "/polls/" + body.pollId + "/votes";
      method = "POST";
      break;
    case "poll-close":
      url += "/polls/" + body.pollId + "/close";
      break;
    case "archive":
    case "rename":
      break;
    default:
      throw new Error("This action is not available.");
  }
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (res.status === 401)
    window.dispatchEvent(new Event("reviewroom:unauthorized"));
  if (!res.ok)
    throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
