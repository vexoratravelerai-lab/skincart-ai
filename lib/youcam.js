const BASE = "https://yce-api-01.makeupar.com";
const SKIN = "/s2s/v2.1/task/skin-analysis";
const FILE = "/s2s/v2.0/file";
const ACTIONS = [
  "hd_moisture","hd_oiliness","hd_radiance","hd_redness",
  "hd_dark_circle","hd_pore","hd_texture","hd_skin_type"
];
const LABELS = {
  hd_moisture:"Hydration", hd_oiliness:"Oil balance",
  hd_radiance:"Radiance", hd_redness:"Visible redness",
  hd_dark_circle:"Dark-circle appearance", hd_pore:"Pore appearance",
  hd_texture:"Texture", hd_skin_type:"Skin type"
};
const CATALOG = {
  hd_moisture:["Barrier Hydration Serum","Hydration"],
  hd_oiliness:["Lightweight Gel Moisturizer","Oil balance"],
  hd_radiance:["Antioxidant Glow Serum","Radiance"],
  hd_redness:["Comfort & Barrier Serum","Comfort"],
  hd_dark_circle:["Brightening Eye Gel","Eye care"],
  hd_pore:["Pore-Refining Serum","Pore care"],
  hd_texture:["Gentle Renewal Serum","Texture"],
  hd_skin_type:["Daily Base Moisturizer","Routine base"]
};
function headers(key){ return {Authorization:`Bearer ${key}`,"Content-Type":"application/json"}; }
async function json(response,label){
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; }
  catch { throw new Error(`${label} returned invalid JSON`); }
  if(!response.ok || (payload.status && payload.status >= 400)){
    throw new Error(`${label}: ${payload.error || payload.error_code || response.status}`);
  }
  return payload;
}
async function upload(key,buffer,fileName,mimeType){
  const meta = await json(await fetch(BASE+FILE,{
    method:"POST", headers:headers(key),
    body:JSON.stringify({files:[{content_type:mimeType,file_name:fileName,file_size:buffer.length}]})
  }),"YouCam upload metadata");
  const info = meta?.data?.files?.[0], request = info?.requests?.[0];
  if(!info?.file_id || !request?.url) throw new Error("No upload URL/file_id returned.");
  const putHeaders = {...(request.headers||{}),"Content-Type":mimeType};
  const put = await fetch(request.url,{method:"PUT",headers:putHeaders,body:buffer});
  if(!put.ok) throw new Error(`Image upload failed (${put.status})`);
  return info.file_id;
}
async function start(key,source){
  const body = {...source,dst_actions:ACTIONS,format:"json",
    miniserver_args:{enable_mask_overlay:true}};
  const result = await json(await fetch(BASE+SKIN,{
    method:"POST",headers:headers(key),body:JSON.stringify(body)
  }),"YouCam skin-analysis start");
  const id = result?.data?.task_id;
  if(!id) throw new Error("No task_id returned.");
  return id;
}
async function poll(key,id){
  for(let i=0;i<24;i++){
    const result = await json(await fetch(`${BASE}${SKIN}/${encodeURIComponent(id)}`,{
      headers:headers(key)
    }),"YouCam skin-analysis status");
    const data = result?.data || {};
    if(data.task_status === "success") return data;
    if(data.task_status === "error") throw new Error(data.error || data.error_code || "YouCam task failed.");
    await new Promise(r=>setTimeout(r,5000));
  }
  throw new Error("Analysis is still processing. Retry shortly.");
}
function addScore(out,type,data){
  if(!data || typeof data!=="object") return;
  const node = typeof data.ui_score==="number" ? data :
    (data.whole && typeof data.whole.ui_score==="number" ? data.whole : null);
  if(node) out.push({type,label:LABELS[type]||type,uiScore:Math.round(node.ui_score),
    rawScore:typeof node.raw_score==="number"?Number(node.raw_score.toFixed(2)):null});
}
function normalize(data){
  const scores=[];
  const output=data?.results?.output;
  if(Array.isArray(output)){
    for(const item of output) addScore(scores,item.type||item.action||item.name,item);
  } else if(data?.results && typeof data.results==="object"){
    for(const [type,node] of Object.entries(data.results)) if(LABELS[type]) addScore(scores,type,node);
  }
  scores.sort((a,b)=>a.uiScore-b.uiScore);
  const routine=scores.slice(0,3).map((item)=>{
    const product=CATALOG[item.type];
    return product ? {name:product[0],category:product[1],basedOn:item.label,score:item.uiScore,
      reason:`Selected because ${item.label.toLowerCase()} is one of the shopper's lowest cosmetic scores.`} : null;
  }).filter(Boolean);
  const overall=data?.results?.all?.score ?? data?.all?.score ?? null;
  const skinAge=data?.results?.skin_age ?? data?.skin_age ?? null;
  return {concerns:scores,routine,overall,skinAge};
}
async function analyze({key,imageBuffer,imageUrl,fileName,mimeType}){
  if(!key) throw new Error("YOUCAM_API_KEY is not configured.");
  let source;
  if(imageUrl) source={src_file_url:imageUrl};
  else if(imageBuffer) source={src_file_id:await upload(key,imageBuffer,fileName,mimeType)};
  else throw new Error("Provide an image.");
  const taskId=await start(key,source);
  const raw=await poll(key,taskId);
  return {taskId,taskStatus:raw.task_status,normalized:normalize(raw),raw};
}
module.exports={ACTIONS,LABELS,CATALOG,normalize,analyze};
