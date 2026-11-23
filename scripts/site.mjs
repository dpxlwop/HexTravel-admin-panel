import { build, context } from "esbuild-wasm";
import { once } from "node:events";
import { cp, mkdir, readFile } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { loadEnvFile } from "node:process";

try {
  loadEnvFile();
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const dev = process.argv.includes("--dev");
const apiBase = (process.env.HEXTRAVEL_API_BASE_URL || "/api/v1").replace(/\/+$/, "");
if (!/^\/(?!\/)[\w/-]+$/.test(apiBase)) {
  const url = new URL(apiBase);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("HEXTRAVEL_API_BASE_URL должен быть HTTP(S) URL без логина, параметров и фрагмента.");
  }
}

function limit(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Некорректный лимит ${name}.`);
  return Math.floor(value * 1024 * 1024);
}

const config = {
  apiBase,
  photoFileLimit: limit("HEXTRAVEL_PHOTO_FILE_LIMIT_MIB", 20),
  photoRequestLimit: limit("HEXTRAVEL_PHOTO_REQUEST_LIMIT_MIB", 10),
};

await mkdir("dist", { recursive: true });
await cp("index.html", "dist/index.html");

const options = {
  entryPoints: { app: "src/main.tsx" },
  outdir: "dist",
  bundle: true,
  format: "esm",
  target: ["safari16.4", "chrome105"],
  jsx: "automatic",
  minify: !dev,
  sourcemap: dev,
  logLevel: "info",
  define: {
    "process.env.NODE_ENV": JSON.stringify(dev ? "development" : "production"),
    __HEXTRAVEL_CONFIG__: JSON.stringify(config),
  },
};

const html = ["index.html", "text/html; charset=utf-8"];
const devAssets = new Map([
  ["/", html],
  ["/index.html", html],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/app.css", ["app.css", "text/css; charset=utf-8"]],
  ["/app.js.map", ["app.js.map", "application/json"]],
  ["/app.css.map", ["app.css.map", "application/json"]],
]);

async function serveAsset(req, res, pathname) {
  const asset = devAssets.get(pathname);
  if (!asset) {
    res.writeHead(404).end();
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  try {
    const [file, contentType] = asset;
    const content = await readFile(`dist/${file}`);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": content.length,
      "Cache-Control": "no-store",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch (error) {
    res.writeHead(error.code === "ENOENT" ? 404 : 500).end();
  }
}

function proxyToGateway(req, res, gateway, path) {
  const send = gateway.protocol === "https:" ? httpsRequest : httpRequest;
  const request = send({
    protocol: gateway.protocol,
    hostname: gateway.hostname,
    port: gateway.port,
    method: req.method,
    path,
    headers: { ...req.headers, host: gateway.host },
  }, (response) => {
    res.writeHead(response.statusCode ?? 502, response.headers);
    response.on("error", () => res.destroy());
    response.pipe(res);
  });
  request.on("error", () => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ message: "Локальный прокси не смог подключиться к серверу." }));
  });
  res.on("close", () => request.destroy());
  req.pipe(request);
}

if (dev) {
  const proxyTarget = process.env.HEXTRAVEL_DEV_PROXY_TARGET;
  const gateway = proxyTarget && apiBase.startsWith("/") ? new URL(proxyTarget) : null;
  if (gateway && (
    !["https:", "http:"].includes(gateway.protocol) ||
    gateway.username || gateway.password || gateway.pathname !== "/" || gateway.search || gateway.hash
  )) {
    throw new Error("HEXTRAVEL_DEV_PROXY_TARGET должен содержать origin Gateway.");
  }

  const host = "127.0.0.1";
  const port = 5173;
  const server = createServer((req, res) => {
    const path = req.url ?? "/";
    if (!path.startsWith("/") || path.startsWith("//")) {
      res.writeHead(400).end();
      return;
    }
    const pathname = path.split("?", 1)[0];
    if (gateway && (pathname === apiBase || pathname.startsWith(`${apiBase}/`))) {
      proxyToGateway(req, res, gateway, path);
      return;
    }
    void serveAsset(req, res, pathname);
  });
  const app = await context(options);
  try {
    await app.rebuild();
    await app.watch();
    await once(server.listen(port, host), "listening");
  } catch (error) {
    await app.dispose().catch(() => {});
    throw error;
  }

  function shutdown() {
    server.close();
    server.closeAllConnections();
    void app.dispose().catch(() => {});
  }
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  console.log(`HexTravel Admin · http://${host}:${port}`);
} else {
  await build(options);
}
