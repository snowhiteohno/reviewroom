import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { User, Session } from "../models/index.js";
import { parse, ApiError } from "../utils/errors.js";
import { userDto } from "../services/projects.js";
import { cookieName, cookieOptions } from "../middleware/auth.js";
const email = z
  .string()
  .trim()
  .email("Please enter a valid email address.")
  .max(254)
  .transform((s) => s.toLowerCase());
const password = z
  .string()
  .min(8, "Use at least 8 characters for your password.")
  .refine(
    (s) => Buffer.byteLength(s, "utf8") <= 72,
    "Your password must be at most 72 bytes.",
  );
async function signIn(user, res, config) {
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  const session = await Session.create({ userId: user._id, expiresAt });
  const token = jwt.sign({ sid: session._id }, config.secret, {
    subject: user._id,
    issuer: "reviewroom",
    audience: "reviewroom-web",
    expiresIn: "7d",
    algorithm: "HS256",
  });
  res.cookie(cookieName, token, {
    ...cookieOptions(config),
    expires: expiresAt,
  });
  return userDto(user);
}
export function authController(config) {
  return {
    register: async (req, res) => {
      const data = parse(
        z.object({
          displayName: z
            .string()
            .trim()
            .min(1, "Please enter your name.")
            .max(60),
          email,
          password,
        }),
        req.body,
      );
      if (await User.exists({ email: data.email }))
        throw new ApiError(409, "An account with that email already exists.");
      const user = await User.create({
        displayName: data.displayName,
        email: data.email,
        passwordHash: await bcrypt.hash(data.password, 12),
      });
      res.status(201).json({ user: await signIn(user, res, config) });
    },
    login: async (req, res) => {
      const data = parse(
        z.object({ email, password: z.string().min(1).max(200) }),
        req.body,
      );
      const user = await User.findOne({ email: data.email }).select(
        "+passwordHash",
      );
      const valid = await bcrypt.compare(
        data.password,
        user?.passwordHash ||
          "$2b$12$abcdefghijklmnopqrstuuVzZ5R4LZYzYsjJ3ZVgSrfDxkxDfyZe",
      );
      if (!user || !valid)
        throw new ApiError(401, "The email or password doesn’t match.");
      res.json({ user: await signIn(user, res, config) });
    },
    me: (req, res) => res.json({ user: userDto(req.user) }),
    logout: async (req, res) => {
      await Session.deleteOne({ _id: req.authSession._id });
      res.clearCookie(cookieName, cookieOptions(config));
      res.json({ ok: true });
    },
  };
}
