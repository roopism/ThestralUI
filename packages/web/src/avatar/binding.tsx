'use client';
import { safeUrl } from "../_shared/safe-url/binding.js";
import { type ReactNode, useState } from "react";
const graphemes = new Intl.Segmenter();
export function Avatar({
  name,
  image,
  fallback,
}: {
  name: string;
  image?: string;
  fallback?: string;
}) {
  const initials = name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((word) => graphemes.segment(word).containing(0)?.segment)
    .join('');
  const src = safeUrl(image);
  const placeholder = <span className="uld-avatar" role="img" aria-label={name}>{fallback ?? initials}</span>;
  return src ? <AvatarImage key={src} src={src} name={name} fallback={placeholder}/> : placeholder;
}
export function AvatarImage({src,name,fallback}:{src:string;name:string;fallback:ReactNode}){
  const [failed,setFailed]=useState(false);
  return failed ? fallback : <img className="uld-avatar" alt={name} src={src} onError={()=>setFailed(true)}/>;
}
