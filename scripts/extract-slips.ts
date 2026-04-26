// scripts/extract-slips.ts —— 一次性从 /tmp/qy-doc/full.txt 抽 100 支签数据
import * as fs from "fs";

const txt = fs.readFileSync("/tmp/qy-doc/full.txt", "utf-8");
const lines = txt.split("\n").map((l) => l.replace(/\r/g, ""));

// 找第 1 签起始：行内容是 "1" 且下一非空行是 "上上" 且再下一非空行是 "心定福自来"
let start = -1;
for (let i = 0; i < lines.length - 6; i++) {
  if (lines[i].trim() === "1") {
    // 找接下来 3 个非空行
    const nonEmpty: string[] = [];
    let j = i + 1;
    while (nonEmpty.length < 3 && j < lines.length) {
      if (lines[j].trim()) nonEmpty.push(lines[j].trim());
      j++;
    }
    if (nonEmpty[0] === "上上" && nonEmpty[1] === "心定福自来") {
      start = i;
      break;
    }
  }
}
if (start === -1) {
  console.error("找不到第 1 签起始");
  process.exit(1);
}
console.log("第 1 签起始 line:", start + 1);

interface Slip {
  number: number;
  level: string;
  title: string;
  poem: string;
  readings: Record<string, string>;
}

const slips: Slip[] = [];
let cursor = start;

for (let n = 1; n <= 100; n++) {
  // 收集接下来 10 个非空行（签号 + 等级 + 签题 + 签诗 + 6 维度）
  const block: string[] = [];
  while (block.length < 10 && cursor < lines.length) {
    const t = lines[cursor].trim();
    cursor++;
    if (t) block.push(t);
  }
  if (block.length < 10) {
    console.error(`第 ${n} 签数据不足，cursor=${cursor}, block=`, block);
    break;
  }
  if (Number(block[0]) !== n) {
    console.error(`期望签号 ${n}, 实际 ${block[0]} 在 line ${cursor}`);
    break;
  }
  slips.push({
    number: n,
    level: block[1],
    title: block[2],
    poem: block[3],
    readings: {
      综合运势: block[4],
      事业学业: block[5],
      财运: block[6],
      感情姻缘: block[7],
      人际贵人: block[8],
      平安健康: block[9],
    },
  });
}

console.log(`抽到 ${slips.length} 支签`);
console.log("第 1 签:", JSON.stringify(slips[0], null, 2));
console.log("第 100 签:", JSON.stringify(slips[99], null, 2));
fs.writeFileSync("/tmp/slips-100.json", JSON.stringify(slips, null, 2));
console.log("已写入 /tmp/slips-100.json");
