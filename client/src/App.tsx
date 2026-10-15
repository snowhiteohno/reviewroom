import {useEffect,useState} from "react";
import Studio from "./Studio";
import type {User} from "./lib/types";
export default function App(){const [user,setUser]=useState<User|null>(null);useEffect(()=>{fetch("/api/auth/me").then(r=>r.ok?r.json():null).then(data=>setUser(data?.user??null)).catch(()=>{})},[]);return user?<Studio user={user}/>:<main className="loading">Your studio is getting ready.</main>}
