import mongoose from "mongoose";
import {Project,Version,Comment,Activity,Favorite} from "../models/index.js";
import {ApiError} from "../utils/errors.js";
export const visibleTo=user=>({$or:[{ownerId:user._id},{"members.email":user.email}]});
export function roleFor(project,user){if(project.ownerId===user._id)return "owner";return project.members.find(m=>m.email===user.email)?.role||null}
export async function access(id,user,session=null){const p=await Project.findById(id).session(session);if(!p)throw new ApiError(404,"This project could not be found.");const role=roleFor(p,user);if(!role)throw new ApiError(403,"You do not have access to this project.");return {project:p,role}}
export async function changeProject(id,user,fn){
 return mongoose.connection.transaction(async session=>{const {project,role}=await access(id,user,session);project.revision+=1;await project.save({session});return fn({project,role,session})});
}
export async function log(project,user,body,session){await Activity.create([{projectId:project._id,actor:user.displayName,body}],{session});project.updatedAt=new Date();await project.save({session})}
export const userDto=u=>({userId:u._id,displayName:u.displayName,email:u.email});
export const versionDto=v=>({id:v._id,project_id:v.projectId,number:v.number,file_key:v.fileKey,file_name:v.fileName,mime:v.mime,width:v.width,height:v.height,status:v.status,created_at:+v.createdAt});
export const commentDto=c=>({id:c._id,project_id:c.projectId,version_id:c.versionId,author_id:c.authorId,author_name:c.authorName,body:c.body,x:c.x,y:c.y,parent_id:c.parentId,resolved:Number(c.resolved),kind:c.kind,resolution:c.resolution,addressed_version_id:c.addressedVersionId,addressed_by:c.addressedBy,verified_by:c.verifiedBy,created_at:+c.createdAt});
export const activityDto=a=>({id:a._id,project_id:a.projectId,actor:a.actor,body:a.body,created_at:+a.createdAt});
export async function projectDto(p,user){const [latest,open,starred]=await Promise.all([p.latestVersionId?Version.findById(p.latestVersionId).lean():null,Comment.countDocuments({projectId:p._id,parentId:null,resolved:false}),Favorite.exists({projectId:p._id,userId:user._id})]);return {id:p._id,owner_id:p.ownerId,name:p.name,description:p.description,category:p.category,color:p.color,archived:Number(p.archived),sample:Number(p.sample),created_at:+p.createdAt,updated_at:+p.updatedAt,cover:latest?._id||null,status:latest?.status||"draft",version_count:p.versionCounter,open_comments:open,starred:Number(!!starred),member_count:p.members.length+1}}
export function requireEditor(role){if(role==="reviewer")throw new ApiError(403,"Only editors can make this change.")}
export function requireOwner(role){if(role!=="owner")throw new ApiError(403,"Only the owner can make this change.")}
