const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
function verify(directory,platform,appVersion,revision){
 const root=fs.readFileSync(path.join(directory,'index.html'),'utf8');const fallback=fs.readFileSync(path.join(directory,'app/index.html'),'utf8');
 assert.ok(root.includes(`window.__MR_STORE_APP_VERSION__='${appVersion}'`),'Early package app version mismatch');
 assert.ok(root.includes(`window.__MR_TV_PACKAGE_PLATFORM__='${platform}'`),'Early package platform mismatch');
 assert.ok(root.indexOf('__MR_STORE_APP_VERSION__')<root.indexOf('./app/js/tv-observability.js'),'Reporter loaded before package metadata');
 assert.doesNotMatch(root,/__APP_VERSION__|__TV_PLATFORM__/);
 const match=fallback.match(/window\.__MR_TV_BUILD__\s*=\s*(\{[^;]+\});/);assert.ok(match,'Fallback build metadata missing');const build=JSON.parse(match[1]);
 assert.equal(build.appVersion,appVersion);assert.equal(build.platform,platform);assert.equal(build.bundleVersion,'local-'+revision);
 const configAt=fallback.indexOf('__MR_TV_BUILD__'),reporterAt=fallback.indexOf('js/tv-observability.js'),compatAt=fallback.indexOf('js/compat-runtime.js');assert.ok(configAt<reporterAt&&reporterAt<compatAt,'Early reporter/config/polyfill order incorrect');
 const reporter=fs.readFileSync(path.join(directory,'app/js/tv-observability.js'),'utf8');assert.doesNotMatch(reporter,/mr_did|tv_device_id|Authorization|api_secret/);
 return {platform,appVersion,bundleVersion:build.bundleVersion,earlyReporterOrder:'passed',diagnosticCredentialsAbsent:true};
}
module.exports={verify};
if(require.main===module){try{console.log(JSON.stringify(verify(process.argv[2],process.argv[3],process.argv[4],process.argv[5])))}catch(error){console.error(error.message);process.exitCode=1}}
