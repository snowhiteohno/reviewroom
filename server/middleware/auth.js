import jwt from "jsonwebtoken";
import { Session, User } from "../models/index.js";
import { ApiError } from "../utils/errors.js";
export const cookieName = "reviewroom_session";
export const cookieOptions = (config) => ({
  httpOnly: true,
  sameSite: "lax",
  secure: config.production,
  path: "/",
});
export function authenticate(config) {
  return async (req, res, next) => {
    let claims;
    try {
      claims = jwt.verify(req.cookies[cookieName] || "", config.secret, {
        algorithms: ["HS256"],
        issuer: "reviewroom",
        audience: "reviewroom-web",
      });
    } catch {
      throw new ApiError(401, "Please sign in to continue.");
    }
    if (typeof claims.sub !== "string" || typeof claims.sid !== "string")
      throw new ApiError(401, "Please sign in to continue.");
    const session = await Session.findOne({
      _id: claims.sid,
      userId: claims.sub,
      expiresAt: { $gt: new Date() },
    });
    if (!session)
      throw new ApiError(401, "Your session has ended. Please sign in again.");
    const user = await User.findById(claims.sub);
    if (!user) throw new ApiError(401, "Please sign in to continue.");
    req.user = user;
    req.authSession = session;
    next();
  };
}
export function checkOrigin(config) {
  return (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.get("origin");
    if (
      req.get("sec-fetch-site") === "cross-site" ||
      (origin && !config.origins.has(origin))
    )
      throw new ApiError(403, "This request is not allowed.");
    next();
  };
}
