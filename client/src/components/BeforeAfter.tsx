import {useState} from "react";
import {ChevronsLeftRight} from "lucide-react";
import type {Version} from "@/lib/types";
export default function BeforeAfter({before,after}:{before:Version;after:Version}){
 const [position,setPosition]=useState(50),different=before.width*after.height!==after.width*before.height;
 return <div className="reveal-comparison"><div className="reveal-frame" style={{aspectRatio:after.width/after.height}}><img className="reveal-base" src={"/api/assets/"+before.id} alt={"Before, version "+before.number}/><div className="reveal-layer" style={{clipPath:"inset(0 0 0 "+position+"%)"}}><img src={"/api/assets/"+after.id} alt={"After, version "+after.number}/></div><span className="reveal-caption before">Version {before.number}</span><span className="reveal-caption after">Version {after.number}</span><div className="reveal-divider" style={{left:position+"%"}}><span><ChevronsLeftRight size={19}/></span></div><input type="range" min={0} max={100} value={position} onChange={e=>setPosition(Number(e.target.value))} aria-label="Before and after position" aria-valuetext={position+"% before, "+(100-position)+"% after"}/></div><div className="reveal-footer"><span>Drag to reveal what changed.</span><output>{position}%</output></div>{different&&<p className="reveal-size-note">These images have different dimensions and are fitted to the same frame.</p>}</div>
}
