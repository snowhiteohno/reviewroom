import {z} from "zod";
import {Version,Comment} from "../models/index.js";
import {parse,ApiError} from "../utils/errors.js";
import {changeProject,log,requireEditor} from "../services/projects.js";
const commentInput=z.object({versionId:z.string().uuid(),body:z.string().trim().min(1,"Please write a little feedback.").max(3000),x:z.number().min(0).max(1).optional(),y:z.number().min(0).max(1).optional(),parentId:z.string().uuid().optional(),kind:z.enum(["suggestion","must_fix"]).default("suggestion")}).refine(v=>(v.x===undefined)===(v.y===undefined),"Pin your feedback inside the design.");
export async function addComment(req,res){const data=parse(commentInput,req.body);await changeProject(req.params.id,req.user,async({project,role,session})=>{
 const version=await Version.findOne({_id:data.versionId,projectId:project._id}).session(session);if(!version)throw new ApiError(404,"This version could not be found.");
 if(data.parentId){const parent=await Comment.findOne({_id:data.parentId,versionId:version._id,projectId:project._id,parentId:null}).session(session);if(!parent)throw new ApiError(400,"This conversation could not be found.")}
 if(!data.parentId&&data.kind==="must_fix"){const latest=await Version.findById(project.latestVersionId).session(session);if(latest?.status==="approved")throw new ApiError(409,"Reopen the latest version before adding a must fix.")}
 await Comment.create([{projectId:project._id,versionId:version._id,authorId:req.user._id,authorName:req.user.displayName,body:data.body,parentId:data.parentId||null,x:data.parentId?null:data.x??null,y:data.parentId?null:data.y??null,kind:data.parentId?"suggestion":data.kind}],{session});await log(project,req.user,(data.parentId?"Replied to feedback":"Left feedback")+" on version "+version.number,session)
 });res.status(201).json({ok:true})}
export async function updateComment(req,res){const data=parse(z.object({action:z.enum(["resolve","reopen","address","verify"]),versionId:z.string().uuid().optional()}),req.body);await changeProject(req.params.id,req.user,async({project,role,session})=>{
 const c=await Comment.findOne({_id:req.params.commentId,projectId:project._id,parentId:null}).session(session);if(!c)throw new ApiError(404,"This conversation could not be found.");
 let note;
 if(data.action==="address"){
  requireEditor(role);if(c.resolution==="verified")throw new ApiError(409,"Reopen this conversation before linking another fix.");
  if(!data.versionId)throw new ApiError(400,"Choose the revision containing the fix.");
  const source=await Version.findById(c.versionId).session(session);const target=await Version.findOne({_id:data.versionId,projectId:project._id}).session(session);
  if(!target||target.number<=source.number)throw new ApiError(400,"Link a later revision to show what changed.");
  c.resolution="addressed";c.addressedVersionId=target._id;c.addressedBy=req.user._id;c.verifiedBy=null;c.resolved=false;note="Marked feedback as addressed in version "+target.number;
 }else if(data.action==="verify"){
  if(c.resolution!=="addressed")throw new ApiError(409,"A designer needs to link a revision before this fix can be verified.");
  if(c.addressedBy===req.user._id)throw new ApiError(403,"Ask another reviewer to verify your fix.");
  if(role==="editor"&&c.authorId!==req.user._id)throw new ApiError(403,"The author, a reviewer, or the owner must verify this fix.");
  c.resolution="verified";c.resolved=true;c.verifiedBy=req.user._id;note="Verified a fix";
 }else{
  if(role==="reviewer"&&c.authorId!==req.user._id)throw new ApiError(403,"Only editors and the author can resolve this conversation.");
  if(data.action==="resolve"&&c.kind==="must_fix")throw new ApiError(409,"A must fix needs a linked revision and a reviewer’s verification.");
  if(data.action==="reopen"){const latest=await Version.findById(project.latestVersionId).session(session);if(c.kind==="must_fix"&&latest?.status==="approved")throw new ApiError(409,"Reopen the latest version before reopening this must fix.")}
  c.resolved=data.action==="resolve";c.resolution=c.resolved?"verified":"open";c.addressedVersionId=null;c.addressedBy=null;c.verifiedBy=c.resolved?req.user._id:null;note=c.resolved?"Resolved a conversation":"Reopened a conversation";
 }
 await c.save({session});await log(project,req.user,note,session);
 });res.json({ok:true})}
