import pptxgen from "pptxgenjs";
import { mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const imgDir = join(root, "public", "img");
const outDir = join(root, "dist-ppt");
const outPath = join(outDir, "个人AI编程经验分享-结构化.pptx");

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Codex";
pptx.subject = "个人 AI 编程经验分享";
pptx.title = "个人 AI 编程经验分享";
pptx.company = "Codex";
pptx.lang = "zh-CN";
pptx.theme = {
	headFontFace: "Georgia",
	bodyFontFace: "Microsoft YaHei",
	lang: "zh-CN",
};
pptx.defineLayout({ name: "CUSTOM_WIDE", width: 13.333, height: 7.5 });
pptx.layout = "CUSTOM_WIDE";
pptx.margin = 0;

const C = {
	nearBlack: "141413",
	darkSurface: "30302E",
	parchment: "F5F4ED",
	ivory: "FAF9F5",
	warmSand: "E8E6DC",
	border: "E8E6DC",
	terracotta: "C96442",
	coral: "D97757",
	charcoal: "4D4C48",
	olive: "5E5D59",
	stone: "87867F",
	silver: "B0AEA5",
	white: "FFFFFF",
};

const W = 13.333;
const H = 7.5;
const totalSlides = 21;

function img(name) {
	return join(imgDir, name);
}

function text(slide, value, x, y, w, h, opts = {}) {
	slide.addText(value, {
		x,
		y,
		w,
		h,
		margin: opts.margin ?? 0,
		breakLine: false,
		fit: "shrink",
		fontFace: opts.fontFace ?? "Microsoft YaHei",
		fontSize: opts.fontSize ?? 18,
		bold: opts.bold ?? false,
		italic: opts.italic ?? false,
		color: opts.color ?? C.nearBlack,
		align: opts.align ?? "left",
		valign: opts.valign ?? "top",
		lineSpacingMultiple: opts.lineSpacingMultiple ?? 0.95,
		bullet: opts.bullet,
		hyperlink: opts.hyperlink,
	});
}

function addBg(slide, dark = false) {
	slide.background = { color: dark ? C.nearBlack : C.parchment };
	if (dark) {
		for (let x = -0.2; x < W; x += 0.5) {
			slide.addShape(pptx.ShapeType.line, {
				x,
				y: 0,
				w: 0,
				h: H,
				line: { color: "242421", transparency: 35, width: 0.5 },
			});
		}
		for (let y = -0.2; y < H; y += 0.5) {
			slide.addShape(pptx.ShapeType.line, {
				x: 0,
				y,
				w: W,
				h: 0,
				line: { color: "242421", transparency: 35, width: 0.5 },
			});
		}
	}
}

function footer(slide, n, dark = false) {
	text(slide, `${String(n).padStart(2, "0")} / ${totalSlides}`, 0.67, 7.0, 1.0, 0.2, {
		fontFace: "Consolas",
		fontSize: 9,
		color: dark ? C.silver : C.stone,
	});
}

function kicker(slide, value, x, y, dark = false) {
	text(slide, value, x, y, 5.6, 0.28, {
		fontSize: 13,
		bold: true,
		color: dark ? C.coral : C.terracotta,
	});
}

function title(slide, value, x, y, w, h, dark = false, size = 39) {
	text(slide, value, x, y, w, h, {
		fontFace: "Georgia",
		fontSize: size,
		color: dark ? C.ivory : C.nearBlack,
	});
}

function body(slide, value, x, y, w, h, dark = false, size = 18) {
	text(slide, value, x, y, w, h, {
		fontSize: size,
		color: dark ? C.silver : C.olive,
		lineSpacingMultiple: 0.9,
	});
}

function card(slide, x, y, w, h, dark = false, opts = {}) {
	slide.addShape(pptx.ShapeType.roundRect, {
		x,
		y,
		w,
		h,
		rectRadius: 0.08,
		fill: { color: dark ? C.darkSurface : C.ivory },
		line: { color: dark ? "3D3D3A" : C.border, width: 0.6 },
		shadow: opts.shadow === false ? undefined : { type: "outer", color: "000000", opacity: 0.08, blur: 1, angle: 45, distance: 1 },
	});
}

function miniCard(slide, x, y, w, h, heading, copy, dark = false) {
	card(slide, x, y, w, h, dark);
	text(slide, heading, x + 0.22, y + 0.24, w - 0.44, 0.42, {
		fontFace: "Georgia",
		fontSize: 21,
		color: dark ? C.ivory : C.nearBlack,
	});
	body(slide, copy, x + 0.22, y + 0.82, w - 0.44, h - 1.0, dark, 13);
}

function tag(slide, value, x, y, dark = false) {
	slide.addShape(pptx.ShapeType.roundRect, {
		x,
		y,
		w: 0.92,
		h: 0.33,
		rectRadius: 0.12,
		fill: { color: dark ? C.nearBlack : C.warmSand },
		line: { color: dark ? C.nearBlack : C.warmSand, transparency: 100 },
	});
	text(slide, value, x + 0.09, y + 0.075, 0.74, 0.12, {
		fontSize: 10,
		color: dark ? C.silver : C.charcoal,
		align: "center",
	});
}

function linkButton(slide, value, x, y, w, target, dark = false) {
	slide.addShape(pptx.ShapeType.roundRect, {
		x,
		y,
		w,
		h: 0.36,
		rectRadius: 0.06,
		fill: { color: dark ? C.darkSurface : C.ivory },
		line: { color: dark ? "3D3D3A" : C.border, width: 0.6 },
	});
	text(slide, value, x + 0.12, y + 0.09, w - 0.24, 0.14, {
		fontSize: 10,
		color: dark ? C.ivory : C.olive,
		hyperlink: { url: target },
	});
}

async function imageSize(path) {
	const buffer = await readFile(path);
	if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
		return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
	}
	throw new Error(`Unsupported image format: ${path}`);
}

async function imageContain(slide, path, x, y, w, h, opts = {}) {
	card(slide, x, y, w, h, opts.dark ?? false, { shadow: opts.shadow });
	const { width, height } = await imageSize(path);
	const ratio = Math.min((w - 0.12) / width, (h - 0.12) / height);
	const iw = width * ratio;
	const ih = height * ratio;
	slide.addImage({
		path,
		x: x + (w - iw) / 2,
		y: y + (h - ih) / 2,
		w: iw,
		h: ih,
	});
}

async function imageCover(slide, path, x, y, w, h, opts = {}) {
	const { width, height } = await imageSize(path);
	const ratio = Math.max(w / width, h / height);
	const iw = width * ratio;
	const ih = height * ratio;
	slide.addImage({
		path,
		x: x + (w - iw) / 2,
		y: y + (h - ih) / 2,
		w: iw,
		h: ih,
		transparency: opts.transparency,
	});
}

function list(slide, items, x, y, w, dark = false) {
	items.forEach((item, i) => {
		card(slide, x, y + i * 0.72, w, 0.52, dark);
		body(slide, item, x + 0.22, y + 0.13 + i * 0.72, w - 0.44, 0.22, dark, 14);
	});
}

function table(slide, x, y, w, rows, dark = false) {
	const col = [0.24, 0.38, 0.38];
	const h = 0.64;
	rows.forEach((row, r) => {
		let cx = x;
		row.forEach((cell, c) => {
			const cw = w * col[c];
			slide.addShape(pptx.ShapeType.rect, {
				x: cx,
				y: y + r * h,
				w: cw,
				h,
				fill: { color: r === 0 ? C.warmSand : dark ? C.darkSurface : C.ivory },
				line: { color: dark ? "3D3D3A" : C.border, width: 0.6 },
			});
			text(slide, cell, cx + 0.14, y + r * h + 0.16, cw - 0.28, 0.25, {
				fontFace: r === 0 ? "Georgia" : "Microsoft YaHei",
				fontSize: r === 0 ? 14 : 12.2,
				color: r === 0 ? C.nearBlack : dark ? C.silver : C.olive,
				bold: r === 0,
			});
			cx += cw;
		});
	});
}

function flow(slide, steps, x, y, w, dark = false) {
	const gap = 0.16;
	const sw = (w - gap * (steps.length - 1)) / steps.length;
	steps.forEach((step, i) => {
		miniCard(slide, x + i * (sw + gap), y, sw, 1.45, step[0], step[1], dark);
		if (i < steps.length - 1) {
			text(slide, "›", x + (i + 1) * sw + i * gap + 0.02, y + 0.54, 0.2, 0.2, {
				fontSize: 22,
				color: C.terracotta,
				align: "center",
			});
		}
	});
}

function makeSlide(n, dark = false) {
	const slide = pptx.addSlide();
	addBg(slide, dark);
	footer(slide, n, dark);
	return slide;
}

async function build() {
	await mkdir(outDir, { recursive: true });

	let s = makeSlide(1);
	kicker(s, "Technical Sharing / AI Programming", 2.05, 1.62);
	title(s, "个人 AI 编程经验分享", 2.05, 2.05, 8.8, 0.9, false, 48);
	body(s, "工具选择、使用流程、踩坑总结，以及一个更重要的结论：AI 编程本质上是文档能力的放大器。", 2.08, 3.1, 6.9, 0.7, false, 17);
	s.addShape(pptx.ShapeType.arc, { x: 9.7, y: 4.4, w: 3.8, h: 3.8, line: { color: C.border, transparency: 10, width: 1.2 }, adjustPoint: 0.2 });

	s = makeSlide(2, true);
	kicker(s, "Core thesis", 5.38, 1.7, true);
	card(s, 2.3, 2.25, 8.7, 2.5, true);
	title(s, "AI 编程的上限，取决于你写文档的能力。", 2.85, 2.78, 7.6, 0.75, true, 33);
	body(s, "需求、边界、规则和审查标准，决定 Agent 最终能抵达哪里。", 3.02, 3.75, 7.2, 0.35, true, 14);

	s = makeSlide(3);
	kicker(s, "Pain points", 0.82, 1.35);
	title(s, "传统开发里，时间常常不是花在创造上。", 0.82, 1.75, 5.35, 1.4, false, 34);
	body(s, "很多精力被消耗在重复搜索、样板代码和上下文切换中。", 0.84, 3.55, 4.6, 0.55, false, 16);
	list(s, ["查文档 / 搜索引擎：找 API 用法，排查报错，反复确认边界。", "写样板代码：CRUD、配置文件、测试用例，机械但不可省。", "上下文切换：从需求、设计、实现、验证之间频繁跳跃。"], 6.55, 1.75, 5.65);

	s = makeSlide(4);
	kicker(s, "Value", 5.95, 1.15);
	title(s, "把“想清楚怎么做”和“真的动手写”之间的摩擦降下来。", 2.5, 1.55, 8.3, 1.3, false, 33);
	miniCard(s, 1.05, 4.05, 3.45, 1.45, "更快起步", "把语法细节、配置模板、低风险重复劳动交给 Agent。");
	miniCard(s, 4.95, 4.05, 3.45, 1.45, "更专注判断", "人的注意力回到需求拆解、架构边界和代码审查。");
	miniCard(s, 8.85, 4.05, 3.45, 1.45, "更稳定协作", "复杂任务里，AI 是不知疲倦但需要清晰约束的 pair programmer。");

	s = makeSlide(5, true);
	kicker(s, "Landscape", 0.84, 0.85, true);
	title(s, "OpenAI 与 Anthropic 的角色感不同。", 0.84, 1.22, 7.2, 0.65, true, 32);
	body(s, "一个更像基础设施生态，一个更像专家型工具箱。", 9.15, 1.2, 3.1, 0.45, true, 15);
	table(s, 0.82, 2.35, 11.7, [
		["维度", "OpenAI", "Anthropic"],
		["定位", "AI 基础设施，产品入口多", "专家型 AI 工具，长于规则和文档"],
		["额度 / 访问", "额度较高，国内访问限制相对少", "免费额度有限，访问限制更多"],
		["主要产品", "ChatGPT、Codex、GPT Image Gen、Sora", "Claude、Claude Code、Claude Design"],
	], true);

	s = makeSlide(6);
	kicker(s, "My stack", 0.82, 1.6);
	title(s, "主力用 OpenAI 生态，Claude 作为补充。", 0.82, 1.98, 5.7, 1.05, false, 32);
	body(s, "Cursor 也在用，但额度不够时会自动降级到 Codex。核心不是站队，而是把工具放在合适的位置。", 0.84, 3.35, 5.0, 0.8, false, 15);
	miniCard(s, 7.0, 2.05, 2.6, 2.1, "OpenAI", "日常问答、Codex 执行、图片生成、快速探索。");
	miniCard(s, 9.9, 2.05, 2.6, 2.1, "Claude", "规则文件、Skill 文档、架构讨论、二次 review。");

	s = makeSlide(7, true);
	card(s, 0.82, 1.0, 5.65, 5.35, true);
	tag(s, "Head", 1.22, 1.42, true);
	title(s, "Claude Code", 1.22, 2.12, 4.4, 0.62, true, 33);
	body(s, "更像决策者：适合制定计划、设计架构、编写规则文件、代码审查。", 1.22, 3.14, 4.3, 0.8, true, 17);
	card(s, 6.85, 1.0, 5.65, 5.35);
	tag(s, "Hands", 7.25, 1.42);
	title(s, "Codex", 7.25, 2.12, 3.2, 0.62, false, 33);
	body(s, "更像执行者：适合边界清晰、颗粒度较小、能快速验证的编码任务。", 7.25, 3.14, 4.25, 0.8, false, 17);

	s = makeSlide(8);
	kicker(s, "Claude Code", 0.82, 1.0);
	title(s, "需求不清晰时，它更愿意先问清楚。", 0.82, 1.38, 5.35, 1.0, false, 31);
	body(s, "适合新项目启动、规则文档、整体 review 这类需要判断力和收敛性的工作。", 0.84, 2.72, 4.8, 0.65, false, 15);
	linkButton(s, "查看 Claude 截图", 0.84, 3.72, 1.55, "img/claude-windows.png");
	await imageContain(s, img("claude-windows.png"), 7.0, 1.05, 4.85, 5.15);

	s = makeSlide(9);
	kicker(s, "Codex", 0.82, 1.1);
	title(s, "任务越小、边界越清晰，Codex 越像一双快手。", 0.82, 1.48, 5.5, 1.18, false, 30);
	body(s, "它的优势是推进速度；风险是需求还没完全说清楚时可能直接开跑。", 0.84, 2.98, 5.0, 0.65, false, 15);
	linkButton(s, "Windows 客户端", 0.84, 3.9, 1.4, "img/codex-windows.png");
	linkButton(s, "CLI 截图", 2.42, 3.9, 1.05, "img/codex-cli.png");
	await imageContain(s, img("codex-windows.png"), 6.75, 0.92, 5.15, 3.15);
	await imageContain(s, img("codex-cli.png"), 6.75, 4.38, 5.15, 1.55);

	s = makeSlide(10, true);
	kicker(s, "Guardrails", 0.82, 1.25, true);
	title(s, "把“先确认边界”写进项目规则。", 0.82, 1.62, 5.55, 1.0, true, 31);
	body(s, "Agent 的行为要靠文档塑形：先理解需求、列出假设、确认边界，再实现。", 0.84, 2.95, 4.85, 0.7, true, 15);
	card(s, 6.65, 1.45, 5.3, 3.1, true);
	text(s, "# AGENT 行为规范\n\n1. 先理解需求，不要立即动手\n2. 列出理解和假设，向用户确认\n3. 明确边界条件\n4. 确认后再开始实现", 7.02, 1.88, 4.65, 2.15, {
		fontFace: "Consolas",
		fontSize: 15,
		color: C.silver,
		lineSpacingMultiple: 0.9,
	});

	s = makeSlide(11);
	kicker(s, "Workflow", 0.82, 0.95);
	title(s, "复杂任务不要一次性全扔给 Agent。", 0.82, 1.32, 5.35, 0.95, false, 31);
	body(s, "先手动拆成小任务，再用 plan、审查、redo 的循环推进。", 0.84, 2.6, 4.75, 0.55, false, 15);
	[["0. 清理现场", "确认 git 工作区干净，方便 redo。"], ["1. /plan", "先讨论需求，产出计划。"], ["2. 审查计划", "修改方向，确认后再执行。"], ["3. 审查代码", "小问题继续修，偏差过大直接 redo。"]].forEach((item, i) => {
		miniCard(s, 6.75, 0.95 + i * 1.02, 5.3, 0.78, item[0], item[1]);
	});
	await imageContain(s, img("todo-snap.png"), 6.75, 5.15, 5.3, 1.35);

	s = makeSlide(12);
	kicker(s, "Daily setup", 0.82, 0.78);
	title(s, "订阅、客户端和入口选择，都影响日常摩擦。", 0.82, 1.12, 8.4, 0.7, false, 31);
	body(s, "国内用户可通过 PayPal 绑定信用卡完成订阅；日常主力是 Windows 客户端。", 0.84, 2.02, 7.8, 0.42, false, 14);
	await imageContain(s, img("chatgpt-paypal-snap.png"), 0.82, 3.0, 3.65, 3.35);
	await imageContain(s, img("codex-windows.png"), 4.84, 3.0, 3.65, 3.35);
	await imageContain(s, img("codex-cli.png"), 8.86, 3.0, 3.65, 3.35);

	s = makeSlide(13, true);
	kicker(s, "Cloud agent", 0.82, 1.2, true);
	title(s, "把 Agent 放到云端，适合自动化和异步执行。", 0.82, 1.58, 5.4, 1.15, true, 30);
	body(s, "Codex Cloud 可以承接总结、写入、提交 PR 等链路型任务。", 0.84, 3.05, 4.65, 0.55, true, 15);
	await imageContain(s, img("codex-cloud-snap.png"), 6.85, 1.0, 5.05, 2.35, { dark: true });
	await imageContain(s, img("codex-cloud-running.png"), 6.85, 3.85, 5.05, 2.35, { dark: true });

	s = makeSlide(14);
	kicker(s, "OpenAI ecosystem", 5.3, 1.08);
	title(s, "ChatGPT 是入口，Codex 是执行端，GPT Image Gen 扩展视觉表达。", 2.2, 1.5, 8.95, 1.12, false, 31);
	miniCard(s, 1.05, 4.05, 3.45, 1.45, "ChatGPT", "陌生技术、报错解释、代码理解和头脑风暴。");
	miniCard(s, 4.95, 4.05, 3.45, 1.45, "Codex", "把清晰的小任务快速推进到可运行状态。");
	miniCard(s, 8.85, 4.05, 3.45, 1.45, "GPT Image Gen", "生成高质量图片，为演示、原型和案例补足视觉材料。");

	s = makeSlide(15);
	kicker(s, "Gpt-Image-2 generation cases", 0.82, 0.72);
	title(s, "有图有真相的时代已经终结！", 0.82, 1.05, 6.0, 0.65, false, 31);
	body(s, "图片生成正在改变“证据”的视觉直觉。越逼真，越需要说明来源、提示词和上下文。", 0.84, 1.92, 7.5, 0.45, false, 14);
	await imageContain(s, img("gpt-image-2-case1.png"), 0.95, 2.85, 5.4, 3.75);
	await imageContain(s, img("gpt-image-2-case2.png"), 6.95, 2.85, 5.4, 3.75);

	s = makeSlide(16, true);
	kicker(s, "Anthropic ecosystem", 0.82, 1.18, true);
	title(s, "Claude 的价值在于规则、文档和审查。", 0.82, 1.55, 5.35, 1.0, true, 31);
	body(s, "免费额度有限，但很适合写 Agent Skill、起草规则文档，以及对 Codex 生成代码做二次 review。", 0.84, 2.9, 4.75, 0.75, true, 15);
	await imageContain(s, img("claude-windows.png"), 6.95, 0.95, 4.8, 5.35, { dark: true });

	s = makeSlide(17);
	kicker(s, "Codex Plugin / Skill", 0.82, 1.0);
	title(s, "把常用能力做成插件，让 Agent 调用同一套规则。", 0.82, 1.38, 5.55, 1.2, false, 30);
	body(s, "把设计规范、工作流和工具说明沉淀成可复用能力。", 0.84, 2.95, 4.85, 0.5, false, 15);
	linkButton(s, "查看 Skill", 0.84, 3.72, 1.05, "doc/web-design-engineer/SKILL/");
	linkButton(s, "查看 DESIGN.md", 2.08, 3.72, 1.35, "doc/DESIGN/");
	await imageContain(s, img("codex-plugin.png"), 6.85, 1.05, 5.1, 4.75);

	s = makeSlide(18);
	kicker(s, "Case study", 5.45, 1.08);
	title(s, "用 Codex Cloud + GitHub Actions + Obsidian 搭建自动化知识沉淀流程。", 2.05, 1.48, 9.25, 1.25, false, 31);
	miniCard(s, 1.05, 4.05, 3.45, 1.45, "文章总结", "看到好文章，不再只靠临时收藏和模糊记忆。");
	miniCard(s, 4.95, 4.05, 3.45, 1.45, "教程沉淀", "软件安装、环境配置，不必下次重新搜索。");
	miniCard(s, 8.85, 4.05, 3.45, 1.45, "对话保存", "把 ChatGPT 中有价值的内容长期放进知识库。");

	s = makeSlide(19, true);
	kicker(s, "Automation pipeline", 0.82, 0.75, true);
	title(s, "从 URL 到 Obsidian，是一条可自动执行的链路。", 0.82, 1.08, 8.0, 0.75, true, 31);
	flow(s, [["输入 URL", "用户发出总结文章任务。"], ["Agent 总结", "Codex Cloud 抓取并整理内容。"], ["写入 MD", "生成结构化 Markdown 文件。"], ["自动合并", "GitHub Actions 处理 PR。"], ["同步浏览", "Obsidian 本地搜索和阅读。"]], 0.82, 2.25, 11.7, true);
	await imageContain(s, img("codex-cloud-snap.png"), 0.82, 4.75, 3.65, 1.6, { dark: true });
	await imageContain(s, img("github-actions-workflows.png"), 4.84, 4.75, 3.65, 1.6, { dark: true });
	await imageContain(s, img("obsidian-map-snap.png"), 8.86, 4.75, 3.65, 1.6, { dark: true });

	s = makeSlide(20);
	kicker(s, "Takeaways", 0.82, 1.25);
	title(s, "真正需要训练的，不是“让 AI 写代码”，而是“让 AI 明白边界”。", 0.82, 1.62, 5.65, 1.45, false, 30);
	body(s, "规则、技能、任务说明，都是 AI 编程里的生产资料。", 0.84, 3.48, 4.85, 0.48, false, 15);
	card(s, 6.9, 1.58, 4.9, 2.2);
	title(s, "写 AGENT.md、写 Skill、写 TODO.md。", 7.3, 2.02, 4.1, 0.72, false, 25);
	body(s, "不擅长写文档没关系：让 AI 帮你写，然后你来审查和修改。", 7.3, 3.0, 4.0, 0.45, false, 13);
	linkButton(s, "AGENTS.md", 7.0, 4.28, 1.1, "doc/AGENTS/");
	linkButton(s, "Skill", 8.28, 4.28, 0.8, "doc/web-design-engineer/SKILL/");
	linkButton(s, "分享稿", 9.26, 4.28, 0.95, "doc/ai编程经验分享/");
	linkButton(s, "总览图", 10.38, 4.28, 0.95, "img/summary-all.png");

	s = makeSlide(21);
	kicker(s, "Overview", 0.82, 0.95);
	title(s, "一张图回看整套分享。", 0.82, 1.32, 4.45, 0.8, false, 31);
	body(s, "从工具选择、Head / Hands 分工，到规则文档、Codex 工作流和个人知识库自动化，所有关键节点汇总在这张图里。", 0.84, 2.42, 4.2, 1.0, false, 15);
	linkButton(s, "打开原图", 0.84, 3.78, 1.0, "img/summary-all.png");
	await imageContain(s, img("summary-all.png"), 6.25, 0.55, 4.7, 6.25);

	await pptx.writeFile({ fileName: outPath });
}

for (const name of [
	"chatgpt-paypal-snap.png",
	"claude-windows.png",
	"codex-cli.png",
	"codex-cloud-running.png",
	"codex-cloud-snap.png",
	"codex-plugin.png",
	"codex-windows.png",
	"github-actions-workflows.png",
	"gpt-image-2-case1.png",
	"gpt-image-2-case2.png",
	"obsidian-map-snap.png",
	"summary-all.png",
	"todo-snap.png",
]) {
	if (!existsSync(img(name))) {
		throw new Error(`Missing image: ${name}`);
	}
}

build()
	.then(() => console.log(`PPTX written to ${outPath}`))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
