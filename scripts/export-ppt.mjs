import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { basename, join } from "node:path";
import { deflateRawSync } from "node:zlib";

const root = process.cwd();
const outDir = join(root, "dist-ppt");
const slideDir = join(outDir, "slides");
const pptxPath = join(outDir, "个人AI编程经验分享.pptx");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const slideWidth = 1920;
const slideHeight = 1080;
const slideCount = 21;

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getFreePort(start = 4510) {
	for (let port = start; port < start + 100; port += 1) {
		const available = await new Promise((resolve) => {
			const server = createServer();
			server.once("error", () => resolve(false));
			server.once("listening", () => {
				server.close(() => resolve(true));
			});
			server.listen(port, "127.0.0.1");
		});
		if (available) return port;
	}
	throw new Error("No free local port found.");
}

function spawnProcess(command, args, shell = process.platform === "win32") {
	return spawn(command, args, {
		cwd: root,
		stdio: "ignore",
		shell,
		windowsHide: true,
	});
}

async function waitForHttp(url, timeoutMs = 20000) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		try {
			const response = await fetch(url);
			if (response.ok) return;
		} catch {
			// Retry until the dev server is ready.
		}
		await delay(250);
	}
	throw new Error(`Timed out waiting for ${url}`);
}

async function waitForJson(url, timeoutMs = 20000) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		try {
			const response = await fetch(url);
			if (response.ok) return response.json();
		} catch {
			// Retry until Chrome exposes the debugging endpoint.
		}
		await delay(250);
	}
	throw new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
	constructor(wsUrl) {
		this.id = 0;
		this.pending = new Map();
		this.socket = new WebSocket(wsUrl);
		this.ready = new Promise((resolve, reject) => {
			this.socket.addEventListener("open", resolve, { once: true });
			this.socket.addEventListener("error", reject, { once: true });
		});
		this.socket.addEventListener("message", (event) => {
			const message = JSON.parse(event.data);
			if (message.id && this.pending.has(message.id)) {
				const { resolve, reject } = this.pending.get(message.id);
				this.pending.delete(message.id);
				if (message.error) reject(new Error(message.error.message));
				else resolve(message.result);
			}
		});
	}

	async send(method, params = {}) {
		await this.ready;
		const id = ++this.id;
		this.socket.send(JSON.stringify({ id, method, params }));
		return new Promise((resolve, reject) => {
			this.pending.set(id, { resolve, reject });
		});
	}

	close() {
		this.socket.close();
	}
}

async function captureSlides(pageUrl) {
	await rm(slideDir, { recursive: true, force: true });
	await mkdir(slideDir, { recursive: true });

	const debugPort = await getFreePort(9222);
	const userDataDir = join(outDir, `chrome-profile-${Date.now()}`);
	await rm(userDataDir, { recursive: true, force: true }).catch(() => {});

	const chrome = spawnProcess(chromePath, [
		"--headless=new",
		`--remote-debugging-port=${debugPort}`,
		`--user-data-dir=${userDataDir}`,
		"--hide-scrollbars",
		"--force-device-scale-factor=1",
		`--window-size=${slideWidth},${slideHeight}`,
		pageUrl,
	], false);

	try {
		const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json`);
		const target = targets.find((item) => item.type === "page") ?? targets[0];
		const cdp = new CdpClient(target.webSocketDebuggerUrl);

		try {
			await cdp.send("Page.enable");
			await cdp.send("Runtime.enable");
			await cdp.send("Emulation.setDeviceMetricsOverride", {
				width: slideWidth,
				height: slideHeight,
				deviceScaleFactor: 1,
				mobile: false,
			});
			await cdp.send("Page.navigate", { url: pageUrl });
			await delay(1200);

			await cdp.send("Runtime.evaluate", {
				expression: `
					(() => {
						localStorage.setItem("ai-programming-share-slide-index", "0");
						document.querySelector(".deck-controls")?.remove();
						document.querySelector(".progress")?.remove();
						const shell = document.querySelector(".deck-shell");
						const stage = document.querySelector("#stage");
						Object.assign(document.documentElement.style, { width: "1920px", height: "1080px", overflow: "hidden" });
						Object.assign(document.body.style, { width: "1920px", height: "1080px", overflow: "hidden" });
						Object.assign(shell.style, { width: "1920px", height: "1080px" });
						Object.assign(stage.style, {
							left: "0",
							top: "0",
							transform: "none",
							boxShadow: "none"
						});
						window.removeEventListener("resize", scaleStage);
					})();
				`,
				awaitPromise: true,
			});

			for (let index = 0; index < slideCount; index += 1) {
				await cdp.send("Runtime.evaluate", {
					expression: `showSlide(${index});`,
					awaitPromise: true,
				});
				await delay(150);
				const screenshot = await cdp.send("Page.captureScreenshot", {
					format: "png",
					captureBeyondViewport: false,
					clip: { x: 0, y: 0, width: slideWidth, height: slideHeight, scale: 1 },
				});
				const filename = join(slideDir, `slide-${String(index + 1).padStart(2, "0")}.png`);
				await writeFile(filename, Buffer.from(screenshot.data, "base64"));
				console.log(`Captured ${basename(filename)}`);
			}
		} finally {
			cdp.close();
		}
	} finally {
		chrome.kill();
		await delay(500);
		await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
	}
}

function crc32(buffer) {
	let crc = ~0;
	for (const byte of buffer) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) {
			crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
		}
	}
	return ~crc >>> 0;
}

function dosTime(date = new Date()) {
	const time =
		(date.getHours() << 11) |
		(date.getMinutes() << 5) |
		Math.floor(date.getSeconds() / 2);
	const day = date.getDate();
	const month = date.getMonth() + 1;
	const year = Math.max(1980, date.getFullYear()) - 1980;
	return { time, date: (year << 9) | (month << 5) | day };
}

function makeZip(files) {
	const localParts = [];
	const centralParts = [];
	let offset = 0;
	const stamp = dosTime();

	for (const file of files) {
		const name = Buffer.from(file.name.replaceAll("\\", "/"));
		const content = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content);
		const shouldStore = file.name.toLowerCase().endsWith(".png");
		const compressed = shouldStore ? content : deflateRawSync(content);
		const method = shouldStore ? 0 : 8;
		const crc = crc32(content);

		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(0, 6);
		local.writeUInt16LE(method, 8);
		local.writeUInt16LE(stamp.time, 10);
		local.writeUInt16LE(stamp.date, 12);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(compressed.length, 18);
		local.writeUInt32LE(content.length, 22);
		local.writeUInt16LE(name.length, 26);
		local.writeUInt16LE(0, 28);
		localParts.push(local, name, compressed);

		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(20, 4);
		central.writeUInt16LE(20, 6);
		central.writeUInt16LE(0, 8);
		central.writeUInt16LE(method, 10);
		central.writeUInt16LE(stamp.time, 12);
		central.writeUInt16LE(stamp.date, 14);
		central.writeUInt32LE(crc, 16);
		central.writeUInt32LE(compressed.length, 20);
		central.writeUInt32LE(content.length, 24);
		central.writeUInt16LE(name.length, 28);
		central.writeUInt16LE(0, 30);
		central.writeUInt16LE(0, 32);
		central.writeUInt16LE(0, 34);
		central.writeUInt16LE(0, 36);
		central.writeUInt32LE(0, 38);
		central.writeUInt32LE(offset, 42);
		centralParts.push(central, name);

		offset += local.length + name.length + compressed.length;
	}

	const centralOffset = offset;
	const central = Buffer.concat(centralParts);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(0, 4);
	end.writeUInt16LE(0, 6);
	end.writeUInt16LE(files.length, 8);
	end.writeUInt16LE(files.length, 10);
	end.writeUInt32LE(central.length, 12);
	end.writeUInt32LE(centralOffset, 16);
	end.writeUInt16LE(0, 20);

	return Buffer.concat([...localParts, central, end]);
}

function slideXml(index) {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:pic><p:nvPicPr><p:cNvPr id="2" name="slide-${index}.png"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function slideRelXml(index) {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/slide-${String(index).padStart(2, "0")}.png"/></Relationships>`;
}

function contentTypesXml() {
	const overrides = Array.from({ length: slideCount }, (_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${overrides}</Types>`;
}

function presentationXml() {
	const ids = Array.from({ length: slideCount }, (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`).join("");
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst>${ids}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="wide"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
}

function presentationRelsXml() {
	const rels = Array.from({ length: slideCount }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("");
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

async function buildPptx() {
	const files = [
		{
			name: "[Content_Types].xml",
			content: contentTypesXml(),
		},
		{
			name: "_rels/.rels",
			content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
		},
		{
			name: "docProps/core.xml",
			content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>个人AI编程经验分享</dc:title><dc:creator>Codex</dc:creator><cp:lastModifiedBy>Codex</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified></cp:coreProperties>`,
		},
		{
			name: "docProps/app.xml",
			content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Codex</Application><PresentationFormat>16:9</PresentationFormat><Slides>${slideCount}</Slides></Properties>`,
		},
		{
			name: "ppt/presentation.xml",
			content: presentationXml(),
		},
		{
			name: "ppt/_rels/presentation.xml.rels",
			content: presentationRelsXml(),
		},
	];

	for (let index = 1; index <= slideCount; index += 1) {
		const slideName = `slide-${String(index).padStart(2, "0")}.png`;
		files.push({
			name: `ppt/slides/slide${index}.xml`,
			content: slideXml(index),
		});
		files.push({
			name: `ppt/slides/_rels/slide${index}.xml.rels`,
			content: slideRelXml(index),
		});
		files.push({
			name: `ppt/media/${slideName}`,
			content: await readFile(join(slideDir, slideName)),
		});
	}

	await writeFile(pptxPath, makeZip(files));
}

async function main() {
	if (!existsSync(chromePath)) {
		throw new Error(`Chrome not found at ${chromePath}`);
	}

	await mkdir(outDir, { recursive: true });
	const port = await getFreePort();
	const server = spawnProcess("pnpm", ["astro", "dev", "--host", "127.0.0.1", "--port", String(port)]);

	try {
		const pageUrl = `http://127.0.0.1:${port}/`;
		await waitForHttp(pageUrl);
		await captureSlides(pageUrl);
		await buildPptx();
		console.log(`PPTX written to ${pptxPath}`);
	} finally {
		server.kill();
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
