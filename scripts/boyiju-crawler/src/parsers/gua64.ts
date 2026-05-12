/**
 * 卜易居 64 卦页面解析器
 *
 * 列表页: https://www.buyiju.com/zhouyi/
 * 详情页: https://www.buyiju.com/zhouyi/yijing/64gua-{n}.html
 */
import * as cheerio from "cheerio";

export interface GuaRawData {
  number: number;
  name: string;
  fullTitle: string;
  /** 金钱课编码如 111111 */
  code: string;
  /** 金钱课等级如 "困龙得水,上上卦" */
  level: string;
  /** 金钱课卦辞 */
  jinQianGuaCi: string;
  /** 金钱课推断 */
  jinQianTuiDuan: string;
  /** 大象 */
  daXiang: string;
  /** 卦辞原文（含爻辞） */
  guaYaoCiRaw: string;
  /** 卦辞 */
  gua_ci: string;
  /** 爻辞 6 条 */
  yao_ci: string[];
  /** 解文全文（含彖辞、象辞、小象传） */
  jieWenRaw: string;
  /** 彖辞 */
  tuan_ci: string;
  /** 大象传 */
  da_xiang: string;
  /** 小象传 6 条 */
  xiao_xiang: string[];
  /** 运势维度 */
  yunshi: string;
  /** 爱情维度 */
  aiqing: string;
  /** 疾病维度 */
  jibing: string;
}

/**
 * 从列表页提取 64 卦链接
 */
export function parseGuaListPage(html: string): { number: number; name: string; url: string }[] {
  const $ = cheerio.load(html);
  const results: { number: number; name: string; url: string }[] = [];

  $(".zhouyi li a, .d5 li a").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const text = $(el).text().trim();
    // 匹配 "1.乾为天" 格式
    const m = text.match(/^(\d+)\.(.+)$/);
    if (m && href.includes("64gua-")) {
      results.push({
        number: parseInt(m[1], 10),
        name: m[2],
        url: href.startsWith("http") ? href : `https://www.buyiju.com${href}`,
      });
    }
  });

  return results;
}

/**
 * 从详情页提取单卦完整数据
 */
export function parseGuaDetailPage(html: string, guaNumber: number): GuaRawData {
  const $ = cheerio.load(html);
  const content = $(".content");

  // 从 title 提取卦名
  const titleText = $(".title h2").text().trim();
  const titleMatch = titleText.match(/第(\d+)卦\s+(\S+)\s+/);
  const guaName = titleMatch?.[2] ?? "";

  // 获取全文文本
  const fullText = content.text();

  // 提取编码和等级: "编码：111111(困龙得水,上上卦)"
  const codeMatch = fullText.match(/编码[：:]\s*(\d{6})\s*\(([^)]+)\)/);
  const code = codeMatch?.[1] ?? "";
  const level = codeMatch?.[2] ?? "";

  // 提取金钱课卦辞: "卦辞：困龙得水好运交..."
  const guaCiMatch = fullText.match(/卦辞[：:]\s*([^？?\n]+)/);
  const jinQianGuaCi = guaCiMatch?.[1]?.trim() ?? "";

  // 提取推断
  const tuiDuanMatch = fullText.match(/推断[：:]\s*([^？?\n]+)/);
  const jinQianTuiDuan = tuiDuanMatch?.[1]?.trim() ?? "";

  // 提取大象
  const daXiangMatch = fullText.match(/大象[：:]\s*([^？?\n]+)/);
  const daXiang = daXiangMatch?.[1]?.trim() ?? "";

  // 提取运势/爱情/疾病
  const yunshiMatch = fullText.match(/运势[：:]\s*([^？?\n]+)/);
  const aiqingMatch = fullText.match(/爱情[：:]\s*([^？?\n]+)/);
  const jibingMatch = fullText.match(/疾病[：:]\s*([^？?\n]+)/);

  // 提取"周易卦爻辞原文"段
  const guaYaoCiRaw = extractSection($, content, "周易卦爻辞原文");
  const { gua_ci, yao_ci } = parseGuaYaoCi(guaYaoCiRaw, guaName);

  // 提取"周易卦爻辞解文"段
  const jieWenRaw = extractSection($, content, "周易卦爻辞解文");
  const { tuan_ci, da_xiang, xiao_xiang } = parseJieWen(jieWenRaw, guaName);

  return {
    number: guaNumber,
    name: guaName,
    fullTitle: titleText,
    code,
    level,
    jinQianGuaCi,
    jinQianTuiDuan,
    daXiang,
    guaYaoCiRaw,
    gua_ci,
    yao_ci,
    jieWenRaw,
    tuan_ci,
    da_xiang,
    xiao_xiang,
    yunshi: yunshiMatch?.[1]?.trim() ?? "",
    aiqing: aiqingMatch?.[1]?.trim() ?? "",
    jibing: jibingMatch?.[1]?.trim() ?? "",
  };
}

/**
 * 提取 <strong>标题</strong> 到下一个 <strong> 或 </div> 之间的文本
 *
 * 卜易居的格式：整个段落可能在一个 <p> 内用 <br> 分隔，
 * 所以需要把 <br> 转为换行符后再提取文本。
 */
function extractSection($: cheerio.CheerioAPI, content: cheerio.Cheerio<any>, title: string): string {
  let found = false;
  let parts: string[] = [];

  content.children("p").each((_, el) => {
    const $p = $(el);
    const strongText = $p.find("strong").text().trim();

    if (strongText.includes(title)) {
      found = true;
      // strong 后面可能有同段文本（<br> 分隔的内容）
      const $clone = $p.clone();
      $clone.find("strong").remove();
      // 把 <br> 替换为换行符，保留原文分行结构
      $clone.find("br").replaceWith("\n");
      const afterStrong = $clone.text().trim();
      if (afterStrong) parts.push(afterStrong);
      return;
    }

    if (found) {
      // 遇到下一个 <strong> 段落标题就停
      if ($p.find("strong").length > 0) {
        found = false;
        return;
      }
      // 同样处理 <br> → 换行
      const $clone = $p.clone();
      $clone.find("br").replaceWith("\n");
      parts.push($clone.text().trim());
    }
  });

  return parts.join("\n");
}

/**
 * 解析卦爻辞原文，拆出卦辞 + 6 爻
 *
 * 格式如：
 * 乾：元，亨，利，贞。
 * 初九：潜龙，勿用。
 * 九二：见龙再田，利见大人。
 * ...
 */
function parseGuaYaoCi(raw: string, guaName: string): { gua_ci: string; yao_ci: string[] } {
  // 清理 HTML 残留标签（如 blockquote 的 > < 残留）
  const cleaned = raw.replace(/^[>\s]+/, "").replace(/[<\s]+$/, "");
  const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);

  let gua_ci = "";
  const yao_ci: string[] = [];

  for (const line of lines) {
    // 爻辞模式：初九/九二/六三/上九/上六/用九/用六 等
    // 卜易居有两种格式：用"："或用"，"分隔（如"初九：…"或"初六，…"）
    if (/^(初[九六]|九[二三四五]|六[二三四五]|上[九六]|用[九六])\s*[：:，,]/.test(line)) {
      yao_ci.push(line);
    } else if (!gua_ci) {
      // 第一条非爻辞 = 卦辞
      gua_ci = line;
    } else {
      // 卦辞续行（少见但可能）
      gua_ci += line;
    }
  }

  return { gua_ci, yao_ci };
}

/**
 * 解析解文，提取彖辞、大象传、小象传
 *
 * 格式如：
 * 《乾卦》象征天：元始，亨通...
 * 《象》曰：天行健，君子以自强不息。
 * 《象辞》说：天道运行周而复始...
 * 初九，龙尚潜伏...《象》曰：潜龙勿用，阳在下也。《象辞》说：...
 */
function parseJieWen(raw: string, guaName: string): { tuan_ci: string; da_xiang: string; xiao_xiang: string[] } {
  // 提取大象传：《象》曰：...（第一个出现的，非爻辞内的）
  const daXiangMatch = raw.match(/《象》曰[：:]\s*([^》\n]+)/);
  const da_xiang = daXiangMatch?.[1]?.trim() ?? "";

  // 提取彖辞：通常在《象》曰 之前的文本段落
  // 卜易居格式中彖辞混在解文开头，没有专门标记
  // 用启发式：取第一个《象》曰之前的文本
  let tuan_ci = "";
  const firstXiang = raw.indexOf("《象》曰");
  if (firstXiang > 0) {
    tuan_ci = raw.substring(0, firstXiang).trim();
  }

  // 提取小象传：每爻的《象辞》说：...
  const xiao_xiang: string[] = [];
  const xiaoXiangRegex = /《象辞》说[：:]\s*([^《\n]+)/g;
  let m;
  while ((m = xiaoXiangRegex.exec(raw)) !== null) {
    xiao_xiang.push(m[1].trim());
  }

  return { tuan_ci, da_xiang, xiao_xiang };
}
