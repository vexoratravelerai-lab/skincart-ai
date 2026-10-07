const y=require("./lib/youcam");
const d=y.normalize({task_status:"success",results:{
  hd_moisture:{ui_score:49,raw_score:42.1},
  hd_oiliness:{ui_score:71,raw_score:64},
  hd_pore:{whole:{ui_score:60,raw_score:55}},
  hd_texture:{whole:{ui_score:75,raw_score:70}},
  all:{score:68.5},skin_age:31
}});
if(y.ACTIONS.length!==8) throw new Error("Expected 8 actions");
if(!y.ACTIONS.every(x=>x.startsWith("hd_"))) throw new Error("Mixed SD/HD actions");
if(d.concerns[0].type!=="hd_moisture") throw new Error("Ranking failed");
if(d.routine.length!==3) throw new Error("Routine failed");
console.log(JSON.stringify(d));
console.log("SkinCart tests passed");
