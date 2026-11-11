const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const forwarded=[];const mod={exports:{}};
vm.runInNewContext(fs.readFileSync('metro.config.js','utf8'),{module:mod,exports:mod.exports,__dirname:process.cwd(),URL,process:{env:{EXPO_PUBLIC_WEB_PREVIEW_PROXY:'1'}},require:id=>id==='expo/metro-config'?{getDefaultConfig:()=>({resolver:{}})}:id==='metro-cache'?{FileStore:class {}}:id==='node:https'?{request:(url,options)=>{forwarded.push({url:String(url),options});const stream=new EventEmitter();stream.write=()=>{};stream.end=()=>{};stream.destroy=()=>{};return stream;}}:require(id)});
const relay=mod.exports.server.enhanceMiddleware(()=>{});
function request(method,path,origin='http://localhost:8081',host='localhost:8081') {const req=new EventEmitter();Object.assign(req,{url:'/__preview-api'+path,method,headers:{host,origin,authorization:'Bearer fixture','content-type':'application/json'}});let status;relay(req,{writeHead(code){status=code},end(){}},()=>{});return status;}
assert.equal(request('POST','/api/user/follow/fixture-member'),undefined);assert.equal(forwarded.at(-1).options.method,'POST');
assert.equal(request('GET','/api/messages/conversations'),undefined);
assert.equal(request('POST','/api/messages/send'),undefined);
assert.equal(request('PATCH','/api/user/notification-settings'),undefined);
const count=forwarded.length;
assert.equal(request('POST','/api/user/follow/fixture-member','https://evil.test'),405);
assert.equal(request('POST','/api/admin/delete-all'),405);
assert.equal(request('POST','/api/messages/send','http://localhost:8081','evil.test'),405);
assert.equal(forwarded.length,count);
console.log('PASS preview follow/chat/preferences forwarding and strict origin/host/route restrictions (upstream mocked)');
