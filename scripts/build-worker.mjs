import {spawnSync} from "node:child_process";
import {createRequire} from "node:module";
import {dirname,join} from "node:path";

const require=createRequire(import.meta.url);
const adapterRoot=dirname(dirname(dirname(require.resolve("@opennextjs/cloudflare"))));
const result=spawnSync(process.execPath,[join(adapterRoot,"dist","cli","index.js"),"build"],{
  stdio:"inherit",
  env:{...process.env,MAZZARI_WORKER_BUILD:"1"},
});
if(result.error)throw result.error;
process.exit(result.status??1);
