const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const base = path.resolve(__dirname, '../frontend/tvanddesktop/apple-tv-and-macos/web-preview');
test('actual React Query rendering avoids optional Proxy tracking on old LG and preserves modern tracking', () => {
  const child = spawnSync(process.execPath, ['-e', `
    const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
    const req=require('node:module').createRequire(${JSON.stringify(path.join(base,'package.json'))});
    const React=req('react'),{renderToString}=req('react-dom/server');
    const {QueryClient,QueryClientProvider,useQuery}=req('@tanstack/react-query');
    const ts=req('typescript'),nativeProxy=global.Proxy;
    const compiled=ts.transpileModule(fs.readFileSync(${JSON.stringify(path.join(base,'src/lib/queryClient.ts'))},'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
    function client(proxy){const m={exports:{}};vm.runInNewContext(compiled,{module:m,exports:m.exports,require:req,Proxy:proxy});return m.exports.queryClient;}
    function Station(){const result=useQuery({queryKey:['native-lg-test'],initialData:['Actual station'],queryFn:async()=>[]});return React.createElement('span',null,result.data[0]);}
    function render(c){return renderToString(React.createElement(QueryClientProvider,{client:c},React.createElement(Station)));}
    global.Proxy=undefined;
    assert.throws(()=>render(new QueryClient()),/Proxy/);
    const legacy=client(undefined);assert.equal(legacy.getDefaultOptions().queries.notifyOnChangeProps,'all');assert.match(render(legacy),/Actual station/);
    global.Proxy=nativeProxy;
    const modern=client(nativeProxy);assert.equal(modern.getDefaultOptions().queries.notifyOnChangeProps,undefined);assert.match(render(modern),/Actual station/);
  `], {encoding:'utf8'});
  assert.equal(child.status,0,child.stderr || child.stdout);
});
