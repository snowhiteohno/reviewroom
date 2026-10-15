import mongoose from "mongoose";
import { models } from "../models/index.js";
export async function connectDatabase(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && !hello.msg?.includes("isdbgrid"))
    throw new Error(
      "Use a MongoDB replica set or Atlas so review updates can run in transactions.",
    );
  await Promise.all(models.map((model) => model.init()));
}
