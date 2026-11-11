/** Cursor travel is independent of the fixed frequency scale. */
export function elasticFrequencyCursor(pull:number,unit:number){
 'worklet';
 const x=Math.max(-110*unit,Math.min(110*unit,pull*1.45));
 const relative=x/(144*unit);
 return {x,y:-5*unit*(1-relative*relative)};
}
