import "dotenv/config";
import {randomBytes} from "node:crypto";
import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import path from "node:path";
export function loadConfig(){
 const production=process.env.NODE_ENV==="production";
 let secret=process.env.JWT_SECRET;
 if(!secret&&!production){mkdirSync(".data",{recursive:true});try{secret=readFileSync(".data/session-secret","utf8")}catch(e){if(e.code!=="ENOENT")throw e;try{writeFileSync(".data/session-secret",randomBytes(48).toString("hex"),{flag:"wx",mode:0o600})}catch(e){if(e.code!=="EEXIST")throw e}secret=readFileSync(".data/session-secret","utf8")}}
 if(!secret||secret.length<32)throw new Error("Set JWT_SECRET to at least 32 random characters.");
 if(production&&!process.env.MONGODB_URI)throw new Error("Set MONGODB_URI before starting in production.");
 const port=Number(process.env.PORT||5180),origin=process.env.APP_ORIGIN||"http://localhost:5174";
 const origins=new Set([new URL(origin).origin]);if(!production){origins.add("http://127.0.0.1:5174");origins.add("http://localhost:"+port);origins.add("http://127.0.0.1:"+port)}
 return {port,production,secret,origins,mongoUri:process.env.MONGODB_URI||"mongodb://127.0.0.1:"+(process.env.LOCAL_MONGO_PORT||27019)+"/reviewroom?replicaSet=reviewroom-dev",uploadDir:path.resolve(process.env.UPLOAD_DIR||".data/uploads")};
}
