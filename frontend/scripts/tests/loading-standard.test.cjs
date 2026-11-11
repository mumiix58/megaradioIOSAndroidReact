const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const files=[];function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())walk(file);else if(/\.tsx?$/.test(file))files.push(file);}}walk('app');walk('src/components');
let rings=0,contexts=0;
for(const file of files){
 const source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 for(const node of ast.statements)if(ts.isImportDeclaration(node)&&node.moduleSpecifier.text==='react-native')for(const spec of node.importClause?.namedBindings?.elements||[]){
  const name=(spec.propertyName||spec.name).text;
  assert.notEqual(name,'ActivityIndicator',`${file}: use the shared Mega ring`);
  if(name==='RefreshControl')assert.equal(file,'src/components/MegaRefreshControl.tsx',`${file}: use shared native-refresh ink`);
 }
 if(/MegaLoadingIndicator/.test(source))rings++;
 if(/MegaLoadingState/.test(source))contexts++;
}
assert.ok(contexts>=18);assert.ok(rings>=35);
const motion=fs.readFileSync('src/hooks/useSharedLoadingMotion.ts','utf8');assert.ok(motion.includes('isInteraction:false'));
const skeleton=fs.readFileSync('src/components/Skeleton.tsx','utf8');assert.ok(!skeleton.includes('Animated.loop'),'shapes must not create their own loops');
console.log(`PASS ${rings} shared-ring consumers, ${contexts} contextual-loading consumers, no independent native spinners/refresh colors in active screens`);
