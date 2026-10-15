import "dotenv/config";
import mongoose from "mongoose";
import {spawn} from "node:child_process";
import {mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function startLocalMongo(){
 if(process.env.MONGODB_URI)return null;
 const port=Number(process.env.LOCAL_MONGO_PORT||27019),uri="mongodb://127.0.0.1:"+port+"/?directConnection=true";
 const inspect=async()=>{const client=new mongoose.mongo.MongoClient(uri,{serverSelectionTimeoutMS:400});try{await client.connect();return await client.db("admin").command({hello:1})}finally{await client.close()}};
 try{const hello=await inspect();if(hello.setName!=="reviewroom-dev")throw new Error("The local MongoDB port is already used by another database.");console.log("Using ReviewRoom’s local MongoDB.");return null}catch(e){if(e.message.includes("already used"))throw e}
 await mkdir(".data/mongo",{recursive:true});
 const child=spawn(process.env.MONGOD_BIN||"mongod",["--dbpath",".data/mongo","--port",String(port),"--bind_ip","127.0.0.1","--replSet","reviewroom-dev","--logpath",".data/mongod.log","--logappend"],{stdio:["ignore","inherit","inherit"]});
 let failure;child.on("error",e=>failure=e);child.on("exit",code=>{if(code)failure=new Error("MongoDB exited. Check .data/mongod.log.")});
 try{
  let ready=false;
  for(let i=0;i<100;i++){if(failure)throw failure;try{await inspect();ready=true;break}catch{await delay(150)}}
  if(!ready)throw new Error("MongoDB did not start. Install mongod or set MONGODB_URI.");
  const client=new mongoose.mongo.MongoClient(uri);await client.connect();
  try{await client.db("admin").command({replSetGetStatus:1})}catch{await client.db("admin").command({replSetInitiate:{_id:"reviewroom-dev",members:[{_id:0,host:"127.0.0.1:"+port}]}})}finally{await client.close()}
  for(let i=0;i<100;i++){if((await inspect()).isWritablePrimary){console.log("Local MongoDB is ready on port "+port+".");return child}await delay(150)}
  throw new Error("MongoDB could not elect its local primary.");
 }catch(e){child.kill("SIGTERM");throw e}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const child=await startLocalMongo();
 if(child){const stop=()=>child.kill("SIGTERM");process.once("SIGINT",stop);process.once("SIGTERM",stop)}
}
