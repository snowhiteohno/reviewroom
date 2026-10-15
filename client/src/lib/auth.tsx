import {createContext,useContext,useEffect,useState,type ReactNode} from "react";
import type {User} from "./types";
type Auth={user:User|null;loading:boolean;error:string;setUser:(user:User|null)=>void;reload:()=>Promise<void>;logout:()=>Promise<void>};
const Context=createContext<Auth|null>(null);
export function AuthProvider({children}:{children:ReactNode}){
 const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 async function reload(){setLoading(true);setError("");try{const res=await fetch("/api/auth/me",{credentials:"include"});if(res.status===401){setUser(null);return}if(!res.ok)throw new Error("Your studio couldn’t connect. Please try again.");const data=await res.json();setUser(data.user)}catch(e){setError((e as Error).message)}finally{setLoading(false)}}
 useEffect(()=>{reload();const expired=()=>setUser(null);window.addEventListener("reviewroom:unauthorized",expired);return()=>window.removeEventListener("reviewroom:unauthorized",expired)},[]);
 async function logout(){const res=await fetch("/api/auth/logout",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:"{}"});if(!res.ok&&res.status!==401)throw new Error("We couldn’t sign you out. Please try again.");setUser(null)}
 return <Context.Provider value={{user,loading,error,setUser,reload,logout}}>{children}</Context.Provider>
}
export function useAuth(){const value=useContext(Context);if(!value)throw new Error("AuthProvider is missing");return value}
