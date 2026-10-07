const BASE="https://yce-api-01.makeupar.com";
const SKIN="/s2s/v2.1/task/skin-analysis";
const FILE="/s2s/v2.0/file";
const ACTIONS=["hd_moisture","hd_oiliness","hd_radiance","hd_redness","hd_dark_circle","hd_pore","hd_texture","hd_skin_type"];
const LABELS={hd_moisture:"Hydration",hd_oiliness:"Oil balance",hd_radiance:"Radiance",hd_redness:"Visible redness",hd_dark_circle:"Dark-circle appearance",hd_pore:"Pore appearance",hd_texture:"Texture",hd_skin_type:"Skin type"};
const CATALOG={hd_moisture:["Barrier Hydration Serum","Hydration"],hd_oiliness:["Lightweight Gel Moisturizer","Oil balance"],hd_radiance:["Antioxidant Glow Serum","Radiance"],hd_redness:["Comfort & Barrier Serum","Comfort"],hd_dark_circle:["Brightening Eye Gel","Eye care"],hd_pore:["Pore-Refining Serum","Pore care"],hd_texture:["Gentle Renewal Serum","Texture"],hd_skin_type:["Daily Base Moisturizer","Routine base"]};

function headers(key){return{Authorization:`Bearer ${key}`,"Content-Type":"application/json"}}
async function asJson(r,label){const text=await r.text();let p={};try{p=text?JSON.parse(text):{}}catch{throw new Error(label+" returned invalid JSON")}if(!r.ok||(p.status&&p.status>=400))throw new Error(`${label}: ${p.error||p.error_code||r.status}`);return p}
function from64(s){const raw=atob(s);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
async function upload(key,bytes,fileName,mimeType){
 const meta=await asJson(await fetch(BASE+FILE,{method:"POST",headers:headers(key),body:JSON.stringify({files:[{content_type:mimeType,file_name:fileName,file_size:bytes.byteLength}]})}),"YouCam upload metadata");
 const info=meta?.data?.files?.[0],request=info?.requests?.[0];if(!info?.file_id||!request?.url)throw new Error("No upload URL/file_id returned.");
 const put=await fetch(request.url,{method:"PUT",headers:{...(request.headers||{}),"Content-Type":mimeType},body:bytes});
 if(!put.ok)throw new Error(`Image upload failed (${put.status})`);return info.file_id
}
async function start(key,source){
 const p=await asJson(await fetch(BASE+SKIN,{method:"POST",headers:headers(key),body:JSON.stringify({...source,dst_actions:ACTIONS,format:"json",miniserver_args:{enable_mask_overlay:true}})}),"YouCam skin-analysis start");
 if(!p?.data?.task_id)throw new Error("No task_id returned.");return p.data.task_id
}
async function poll(key,id){
 for(let i=0;i<24;i++){const p=await asJson(await fetch(`${BASE}${SKIN}/${encodeURIComponent(id)}`,{headers:headers(key)}),"YouCam skin-analysis status");const d=p?.data||{};if(d.task_status==="success")return d;if(d.task_status==="error")throw new Error(d.error||d.error_code||"YouCam task failed.");await new Promise(r=>setTimeout(r,5000))}
 throw new Error("Analysis is still processing. Retry shortly.")
}
function addScore(out,type,data){if(!data||typeof data!=="object")return;const n=typeof data.ui_score==="number"?data:(data.whole&&typeof data.whole.ui_score==="number"?data.whole:null);if(n)out.push({type,label:LABELS[type]||type,uiScore:Math.round(n.ui_score),rawScore:typeof n.raw_score==="number"?Number(n.raw_score.toFixed(2)):null})}
function normalize(data){
 const scores=[],output=data?.results?.output;if(Array.isArray(output)){for(const item of output)addScore(scores,item.type||item.action||item.name,item)}else if(data?.results&&typeof data.results==="object"){for(const [type,node]of Object.entries(data.results))if(LABELS[type])addScore(scores,type,node)}
 scores.sort((a,b)=>a.uiScore-b.uiScore);
 const routine=scores.slice(0,3).map(item=>{const p=CATALOG[item.type];return p?{name:p[0],category:p[1],basedOn:item.label,score:item.uiScore,reason:`Selected because ${item.label.toLowerCase()} is one of the shopper's lowest cosmetic scores.`}:null}).filter(Boolean);
 return{concerns:scores,routine,overall:data?.results?.all?.score??data?.all?.score??null,skinAge:data?.results?.skin_age??data?.skin_age??null}
}
function j(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}})}
async function analyze(req,env){
 if(!env.YOUCAM_API_KEY)return j({error:"YOUCAM_API_KEY is not configured."},503);
 const b=await req.json();let source;
 if(b.imageUrl)source={src_file_url:b.imageUrl};else if(b.imageBase64){const bytes=from64(b.imageBase64);if(bytes.byteLength>8*1024*1024)return j({error:"Use an image under 8 MB."},413);source={src_file_id:await upload(env.YOUCAM_API_KEY,bytes,b.fileName||"selfie.jpg",b.mimeType||"image/jpeg")}}else return j({error:"Provide an image."},400);
 const taskId=await start(env.YOUCAM_API_KEY,source);const raw=await poll(env.YOUCAM_API_KEY,taskId);return j({taskId,taskStatus:raw.task_status,normalized:normalize(raw),raw})
}
export default{async fetch(req,env){
 const url=new URL(req.url);
 if(url.pathname==="/api/status")return j({ok:true,project:"SkinCart AI",youcamConfigured:Boolean(env.YOUCAM_API_KEY)});
 if(url.pathname==="/api/analyze"&&req.method==="POST"){try{return await analyze(req,env)}catch(e){return j({error:e?.message||"Analysis failed."},500)}}
 return env.ASSETS.fetch(req)
}};
