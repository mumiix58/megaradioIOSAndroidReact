const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'../frontend/tvanddesktop/apple-tv-and-macos/web-preview');const ts=require(path.join(base,'node_modules/typescript')),postcss=require(path.join(base,'node_modules/postcss'));
function values(initializer){if(ts.isStringLiteral(initializer))return [+initializer.text];if(ts.isJsxExpression(initializer))return expression(initializer.expression);return[]}
function expression(n){if(!n)return[];if(ts.isNumericLiteral(n)||ts.isStringLiteral(n))return [+n.text];if(ts.isConditionalExpression(n))return [...expression(n.whenTrue),...expression(n.whenFalse)];if(ts.isPropertyAccessExpression(n)){let value;function find(d){if(ts.isVariableDeclaration(d)&&d.name.getText()===n.expression.getText()&&d.initializer&&ts.isObjectLiteralExpression(d.initializer)){const property=d.initializer.properties.find(p=>ts.isPropertyAssignment(p)&&p.name.getText()===n.name.text);if(property)value=property.initializer}ts.forEachChild(d,find)}find(n.getSourceFile());if(value)return expression(value)}throw Error('Gap must expose bounded numeric alternatives: '+n.getText())}
function inventory(){const items=[];function walk(dir){for(const f of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,f.name);if(f.isDirectory())walk(file);else if(/\.tsx$/.test(f.name)){const text=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);function visit(n){if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const attrs=new Map(n.attributes.properties.filter(ts.isJsxAttribute).map(a=>[a.name.getText(ast),a.initializer]));if(attrs.has('data-tv-gap-axis')){assert.ok(attrs.has('data-tv-gap'),file+' missing spacing value');items.push({file,axis:attrs.get('data-tv-gap-axis').text,gaps:values(attrs.get('data-tv-gap')),wrap:attrs.get('data-tv-gap-wrap')?.text})}}ts.forEachChild(n,visit)}visit(ast)}}}walk(path.join(base,'src'));return items}
const css=postcss.parse(fs.readFileSync(path.join(base,'public/css/tv-flex-gap.css'),'utf8'));
function declaration(selectorPart,property,value){let match=false;css.walkRules(rule=>{if(selectorPart.every(part=>rule.selector.includes(part)))rule.walkDecls(property,d=>{if(d.value===value&&d.important)match=true})});return match}
test('every actual annotated TV row/column has a static old-engine margin rule, including dynamic gap alternatives',()=>{
 const items=inventory();assert.ok(items.length>0);for(const item of items){assert.ok(['row','column'].includes(item.axis));for(const gap of item.gaps){assert.ok(Number.isFinite(gap)&&gap>=0,item.file);if(item.wrap)continue;const selector=['html.mr-no-flex-gap','[data-tv-gap-axis="'+item.axis+'"]','[data-tv-gap="'+gap+'"]'];assert.ok(declaration(selector,item.axis==='row'?'-webkit-margin-start':'margin-top',gap+'px'),item.file+' lacks old-engine '+item.axis+' gap '+gap)}}
 assert.ok(declaration(['html.mr-no-flex-gap','[data-tv-gap]'],'gap','0'),'forced fallback disables native flex gap only on opt-in containers');
});
test('fixed Search wrap preserves four columns, row spacing, RTL start edge and auto-alignment exceptions',()=>{
 const search=fs.readFileSync(path.join(base,'src/pages/Search.tsx'),'utf8');assert.match(search,/width: '690px'[^>]*data-tv-gap-axis="row" data-tv-gap="14" data-tv-gap-wrap="4"/);assert.match(search,/recentStations\.slice\(0, 8\)/);assert.match(search,/w-\[162px\]/);assert.equal(4*162+3*14,690);
 assert.ok(declaration(['html.mr-no-flex-gap','[data-tv-gap-wrap="4"] > *'],'-webkit-margin-start','14px'));
 assert.ok(declaration(['[data-tv-gap-wrap="4"] > :nth-child(4n+1)'],'-webkit-margin-start','0'));
 assert.ok(declaration(['[data-tv-gap-wrap="4"] > :nth-child(n+5)'],'margin-top','14px'));
 assert.ok(declaration(['[data-tv-gap-axis="row"]','~ .ml-auto'],'-webkit-padding-start','10.66px'));
 for(const [gap,extra,total]of [[32,16,48],[48,32,80],[64,48,112]])assert.ok(declaration(['[data-tv-gap-axis="column"][data-tv-gap="'+gap+'"]','[data-tv-gap-extra="'+extra+'"]'],'margin-top',total+'px'));
});

test('variable onboarding wrap and ignored overlays have bounded explicit fallback contracts',()=>{
 const onboarding=fs.readFileSync(path.join(base,'src/pages/OnboardingPremium.tsx'),'utf8');
 assert.match(onboarding,/premium-benefit-wrap-bound[^>]+maxWidth: 1824/);
 assert.match(onboarding,/data-tv-gap-wrap="flow"/);
 let flow,child;css.walkRules(r=>{if(r.selector==='html.mr-no-flex-gap [data-tv-gap-wrap="flow"][data-tv-gap="16"]')flow=r;if(r.selector==='html.mr-no-flex-gap [data-tv-gap-wrap="flow"][data-tv-gap="16"] > *')child=r});
 const get=(r,p)=>r.nodes.find(n=>n.prop===p)?.value;
 assert.equal(get(flow,'width'),'calc(100% + 16px)');assert.equal(get(flow,'-webkit-margin-start'),'-16px');assert.equal(get(child,'-webkit-margin-start'),'16px');assert.equal(get(child,'margin-top'),'16px');
 let scoped=false;css.walkRules(r=>{if(r.selector.includes('[data-tv-gap-axis="row"]')&&r.selector.includes(':not([data-tv-gap-ignore]) ~ :not([data-tv-gap-ignore])'))scoped=true});assert.ok(scoped);
});

test('verbatim public fallback stays linked outside the prefix-stripping CSS pipeline',()=>{
 const html=fs.readFileSync(path.join(base,'index.html'),'utf8');assert.match(html,/<link[^>]+href=["']\.\/css\/tv-flex-gap\.css["']/);
 const raw=fs.readFileSync(path.join(base,'public/css/tv-flex-gap.css'),'utf8');assert.match(raw,/-webkit-margin-start:/);assert.match(raw,/html\.mr-no-flex-gap/);
 const modern=fs.readFileSync(path.join(base,'src/index.css'),'utf8');assert.ok(!modern.includes('html.mr-no-flex-gap'),'verbatim fallback must not enter prefix-stripping PostCSS pipeline');
});
