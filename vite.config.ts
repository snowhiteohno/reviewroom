import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath} from "node:url";
export default defineConfig({
 plugins:[react()],
 publicDir:"client/public",
 resolve:{alias:{"@":fileURLToPath(new URL("./client/src",import.meta.url))}},
 server:{host:"127.0.0.1",port:5174,strictPort:true,proxy:{"/api":{target:"http://127.0.0.1:5180",changeOrigin:false}}},
 build:{outDir:"dist/client",emptyOutDir:true}
});
