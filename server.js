const http = require("http");
const fs = require("fs");
const path = require("path");
const { analyze } = require("./lib/youcam");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(__dirname, "public");
const TYPES = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".svg":"image/svg+xml" };

function send(res, status, body, type="application/json; charset=utf-8") {
  res.writeHead(status, {"Content-Type":type,"Cache-Control":"no-store"});
  res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
}
async function readJson(req) {
  const parts=[]; let size=0;
  for await (const chunk of req) {
    size += chunk.length;
    if(size > 12*1024*1024) throw new Error("Request too large.");
    parts.push(chunk);
  }
  return JSON.parse(Buffer.concat(parts).toString("utf8") || "{}");
}
async function api(req,res,url) {
  if(url.pathname==="/api/status" && req.method==="GET")
    return send(res,200,{ok:true,project:"SkinCart AI",youcamConfigured:Boolean(process.env.YOUCAM_API_KEY)});
  if(url.pathname==="/api/analyze" && req.method==="POST") {
    try {
      const body=await readJson(req);
      const imageBuffer=body.imageBase64 ? Buffer.from(body.imageBase64,"base64") : null;
      if(imageBuffer && imageBuffer.length>8*1024*1024) return send(res,413,{error:"Use an image under 8 MB."});
      const result=await analyze({key:process.env.YOUCAM_API_KEY,imageBuffer,imageUrl:body.imageUrl,fileName:body.fileName||"selfie.jpg",mimeType:body.mimeType||"image/jpeg"});
      return send(res,200,result);
    } catch(e) { return send(res,500,{error:e.message||"Analysis failed."}); }
  }
  return false;
}
function staticFile(res,url) {
  let rel=url.pathname==="/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const file=path.resolve(PUBLIC,rel);
  if(!file.startsWith(PUBLIC)) return send(res,403,"Forbidden","text/plain; charset=utf-8");
  fs.readFile(file,(err,data)=>{
    if(err) return send(res,404,"Not found","text/plain; charset=utf-8");
    send(res,200,data,TYPES[path.extname(file).toLowerCase()]||"application/octet-stream");
  });
}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,`http://${req.headers.host||"localhost"}`);
  const handled=await api(req,res,url);
  if(handled!==false) return;
  staticFile(res,url);
});
server.listen(PORT,()=>console.log(`SkinCart AI listening on ${PORT}`));
