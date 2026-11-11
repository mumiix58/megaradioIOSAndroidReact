const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const moduleObject={exports:{}};
const code=ts.transpileModule(fs.readFileSync('src/utils/elasticFrequency.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(code,{module:moduleObject,exports:moduleObject.exports});
const cursor=moduleObject.exports.elasticFrequencyCursor;
for(const unit of [.7,1]){
 const center=cursor(0,unit),left=cursor(-40*unit,unit),right=cursor(40*unit,unit);
 assert.equal(center.x,0);assert.ok(left.x<-50*unit&&right.x>50*unit,'cursor travels across the fixed scale');assert.equal(left.x,-right.x);assert.equal(left.y,right.y,'cursor follows the same scale arc in either direction');
 assert.equal(cursor(10000,unit).x,110*unit);assert.equal(cursor(-10000,unit).x,-110*unit,'end stops keep the marker clear of arrow grips');
 assert.ok(right.y>center.y,'cursor follows the curved ruler rather than dragging the whole ruler');
}
console.log('PASS independent frequency cursor travel, symmetric arc and arrow-grip end stops');
