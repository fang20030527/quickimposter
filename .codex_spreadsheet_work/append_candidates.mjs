import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const outputPath = "/Users/cathug/Documents/quickimposter-main/outputs/019f7a65-bee0-7210-85b4-6f661cdcfff2/backlink_comment_opportunities.xlsx";
const previewPath = "/Users/cathug/Documents/quickimposter-main/.codex_spreadsheet_work/final_target_preview.png";
const verifyDate = new Date("2026-07-19T00:00:00+08:00");

const rows = [
  [
    "central.mymagic.my",
    "https://central.mymagic.my/cv/5al0c54a",
    "Malaysia Startup Talentbank – Basketball Stars profile",
    "中",
    33,
    13,
    "已验证公开资料页可加载；可见 My Website 链接；注册及新建资料流程尚未完全验证",
    "个人资料中的 My Website 链接；不依赖博客评论字段",
    "可能 Follow；Semrush 明细未显示 NF/UGC，实际属性待注册后复核",
    "低",
    "B（资料页待验证）",
    "若平台仍允许注册，先完整填写真实职业或项目资料，再添加品牌主页；避免建立空壳资料；提交前确认账号和资料编辑权限。",
    verifyDate,
    "basketball-stars.io",
    "个人资料链接 / 注册与编辑流程待验证",
  ],
  [
    "studybreaks.com",
    "https://studybreaks.com/thoughts/gaming-is-much-more-than-a-game-the-perfect-break-from-studying/",
    "Gaming Is Much More than a Game: The Perfect Break from Studying",
    "高",
    31,
    17,
    "已验证开放；评论框、Website 字段和 Post Comment 按钮均可见",
    "有独立 Website 字段（已验证）",
    "UGC；Semrush 未标 nofollow，最终属性以实际发布结果为准",
    "低",
    "A（优先测试）",
    "用英文回应游戏作为学习间歇、压力管理或注意力恢复的具体观点；Website 填品牌主页，姓名使用自然品牌名，正文不重复放链接。",
    verifyDate,
    "basketball-stars.io",
    "独立 Website 字段（已验证）",
  ],
  [
    "mynintendonews.com",
    "https://mynintendonews.com/2023/04/10/nintendo-is-after-the-person-who-leaked-the-zelda-tears-of-the-kingdom-art-book/",
    "Nintendo is after the person who leaked the Zelda: Tears of the Kingdom art-book",
    "高",
    42,
    9,
    "已验证开放；Leave a Reply 存在，表单为嵌入式；现有评论作者名称可链接外部网站",
    "嵌入式评论的作者链接；独立 Website 字段尚未完全验证",
    "Nofollow + UGC（Semrush）",
    "低至中",
    "A-（优先测试）",
    "用英文讨论游戏泄露、版权或玩家体验，并引用文章细节；若表单提供 Website 再填主页；不要在正文强行插入篮球站链接。",
    verifyDate,
    "basketball-stars.io",
    "评论作者链接 / 嵌入式表单待验证",
  ],
  [
    "soundofhockey.com",
    "https://soundofhockey.com/2026/04/16/as-kraken-season-ends-with-a-thud-which-players-could-be-exiting-this-summer/",
    "As Kraken season ends with a thud, which players could be exiting this summer?",
    "中至高",
    33,
    10,
    "已验证开放；Leave a Reply 存在；现有评论作者名称可链接外部网站",
    "评论作者链接；独立 Website 字段位于嵌入式表单，尚未完全验证",
    "Nofollow + UGC（Semrush）",
    "低",
    "A-（优先测试）",
    "用英文围绕 Kraken 阵容、休赛期交易或文章提到的球员写有依据的评论；姓名不要使用关键词锚文本，正文不额外堆链接。",
    verifyDate,
    "basketball-stars.io",
    "评论作者链接 / Website 字段待验证",
  ],
  [
    "aftv.co.uk",
    "https://aftv.co.uk/latest-arsenal-news/declan-rice-fit-for-englands-world-cup-semi-final-as-tuchel-confirms-a-midfield-boost-against-argentina/",
    "Declan Rice fit for England’s World Cup Semi-Final as Tuchel confirms midfield boost against Argentina",
    "高",
    41,
    9,
    "已验证开放；展开评论后可见 Your Comment、Website 和 Post Comment",
    "有独立 Website 字段（已验证）",
    "Nofollow + UGC（Semrush）",
    "低",
    "A（优先测试）",
    "用英文评论 Rice 的状态、英格兰中场或比赛对位，并引用文章信息；Website 填主页，姓名用自然品牌名，避免正文再放 URL。",
    verifyDate,
    "basketball-stars.io",
    "独立 Website 字段（已验证）",
  ],
  [
    "barcawelt.de",
    "https://www.barcawelt.de/sonstiges/wm-2026-yamal-pedri-und-co-tragen-barcas-handschrift-ins-achtelfinale/",
    "WM 2026: Yamal, Pedri und Co. tragen Barças Handschrift ins Achtelfinale",
    "高",
    43,
    9,
    "已验证评论区开放；必须登录后评论；页面同时提供社区讨论入口",
    "注册后的评论作者/个人资料链接；评论正文 URL 可尝试，但需遵守审核规则",
    "Nofollow + UGC（Semrush）",
    "低至中",
    "A-（注册后测试）",
    "使用自然德语讨论巴萨球员或西班牙队打法；先完善资料，再测试作者链接；正文 URL 仅在确有上下文时少量使用。",
    verifyDate,
    "basketball-stars.io",
    "需注册 / 资料链接 / 评论正文 URL 可尝试",
  ],
  [
    "planetminecraft.com",
    "https://www.planetminecraft.com/blog/dreamcore-5475649/",
    "Dreamcore",
    "中",
    66,
    5,
    "已验证站点活跃；可注册；博客与论坛持续有新回复；来源页已有 UGC 外链",
    "注册后的个人资料、博客评论或论坛回复；独立 Website 字段未完全验证",
    "Nofollow + UGC（Semrush）",
    "低",
    "A-（注册后测试）",
    "优先把主页放在资料页；只在 Minecraft、像素美术或沙盒游戏相关讨论中自然回复，避免在无关作品页推广篮球游戏。",
    verifyDate,
    "basketball-stars.io",
    "需注册 / 社区资料链接 / 博客与论坛回复",
  ],
  [
    "discuss.facts.net",
    "https://discuss.facts.net/threads/basketball-stars-one-on-one-hoops-mastery.18987/",
    "Basketball Stars: One-on-One Hoops Mastery",
    "高",
    23,
    16,
    "已验证可注册/登录；页面显示回复编辑区和 Post reply 按钮",
    "论坛回复中的自然 URL 或个人资料链接；独立 Website 字段未验证",
    "Nofollow + UGC（Semrush）",
    "中",
    "B（注册后测试）",
    "仅补充操作技巧、阵容或一对一玩法体验；不要重复原帖推广文案；优先资料链接，正文 URL 只在回答问题时使用。",
    verifyDate,
    "basketball-stars.io",
    "需注册 / 论坛回复 / 正文 URL 或资料链接待测",
  ],
  [
    "forum.openmediavault.org",
    "https://forum.openmediavault.org/index.php?thread%2F57404-ups-plugin-compatibility%2F",
    "UPS plugin compatibility - Plugins - openmediavault",
    "低",
    44,
    15,
    "已验证注册入口存在；登录后可参与论坛回复",
    "个人资料链接或论坛正文裸 URL；独立 Website 字段未验证",
    "Nofollow + UGC（Semrush）",
    "低",
    "B-（仅相关场景）",
    "只有在确实了解 OpenMediaVault、UPS 或插件兼容问题时参与；不要把游戏链接放进无关技术回复，优先仅测试资料页链接。",
    verifyDate,
    "basketball-stars.io",
    "需注册 / 技术论坛资料链接 / 正文 URL 待测",
  ],
  [
    "lucidowners.com",
    "https://lucidowners.com/threads/service-mode.16078/",
    "Service Mode | Lucid Owners - Lucid Motors Forum",
    "低",
    33,
    16,
    "已验证 Register 入口存在；页面明确提示登录或注册后才能回复",
    "个人资料链接或论坛正文裸 URL；独立 Website 字段未验证",
    "Nofollow + UGC（Semrush）",
    "低",
    "B-（仅相关场景）",
    "仅在有真实 Lucid 使用、维护或 Service Mode 经验时参与；若无相关经验应跳过，避免用无关游戏链接污染汽车论坛。",
    verifyDate,
    "basketball-stars.io",
    "需注册 / 论坛资料链接 / 正文 URL 待测",
  ],
  [
    "blog.altenew.com",
    "https://blog.altenew.com/bellflower-bliss-layering-die-cut-negative-space/",
    "Play with Negative Space with 2 Bellflower Cards!",
    "低",
    40,
    15,
    "已验证评论开放；Leave a Reply 为嵌入式表单；页面启用 Akismet，现有作者名称可链接外站",
    "评论作者链接；独立 Website 字段尚未完全验证",
    "Nofollow + UGC（Semrush）",
    "低至中",
    "C+（仅自然评论）",
    "仅在能真实讨论卡片分层、负空间或手工设计时使用；不要发表通用赞美语，也不要在正文插入与手工主题无关的游戏 URL。",
    verifyDate,
    "basketball-stars.io",
    "博客评论作者链接 / 嵌入式表单待验证",
  ],
];

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
const sheet = workbook.worksheets.getItem("原有网站（恢复）");
const table = sheet.tables.getItem("RestoredLegacySites");

// Keep every existing row and append the new candidates to the table tail.
table.rows.add(null, rows);

const firstNewRow = 8;
const lastNewRow = firstNewRow + rows.length - 1;
const newRange = sheet.getRange(`A${firstNewRow}:O${lastNewRow}`);
newRange.format.wrapText = true;
newRange.format.verticalAlignment = "top";
newRange.format.rowHeight = 78;
sheet.getRange(`E${firstNewRow}:F${lastNewRow}`).format.horizontalAlignment = "center";
sheet.getRange(`M${firstNewRow}:M${lastNewRow}`).format.numberFormat = "yyyy-mm-dd";

// Extend the workbook's existing semantic color treatment into appended rows.
sheet.getRange(`G${firstNewRow}:H${lastNewRow}`).format.fill = "#C9F2E8";
sheet.getRange(`I${firstNewRow}:I${lastNewRow}`).format.fill = "#C8E7F3";
sheet.getRange(`K${firstNewRow}:K${lastNewRow}`).format.fill = "#FFF1B8";
sheet.getRange(`O${firstNewRow}:O${lastNewRow}`).format.fill = "#DCEAFF";

const keyCheck = await workbook.inspect({
  kind: "table",
  range: `原有网站（恢复）!A1:O${lastNewRow}`,
  include: "values,formulas",
  tableMaxRows: 25,
  tableMaxCols: 15,
  tableMaxCellChars: 110,
  maxChars: 24000,
});
console.log("KEY_CHECK");
console.log(keyCheck.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log("ERROR_SCAN");
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "原有网站（恢复）",
  range: `A1:O${lastNewRow}`,
  scale: 0.85,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(`OUTPUT=${outputPath}`);
console.log(`PREVIEW=${previewPath}`);
