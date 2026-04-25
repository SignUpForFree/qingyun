import lunar from "lunar-javascript";
const { Solar } = lunar;

function probe(h, m) {
  const s = Solar.fromYmdHms(1990, 6, 15, h, m, 0);
  const ec = s.getLunar().getEightChar();
  console.log(`14:${m} → time pillar:`, ec.getTimeGan(), ec.getTimeZhi());
}

for (const m of [0, 15, 30, 31, 45]) {
  probe(14, m);
}

// 边界
console.log("---");
const s1 = Solar.fromYmdHms(1990, 6, 15, 14, 30, 0);
console.log("14:30:00 →", s1.getLunar().getEightChar().getTimeGan(), s1.getLunar().getEightChar().getTimeZhi());
const s2 = Solar.fromYmdHms(1990, 6, 15, 14, 30, 37);
console.log("14:30:37 →", s2.getLunar().getEightChar().getTimeGan(), s2.getLunar().getEightChar().getTimeZhi());
const s3 = Solar.fromYmdHms(1990, 6, 15, 15, 0, 0);
console.log("15:00:00 →", s3.getLunar().getEightChar().getTimeGan(), s3.getLunar().getEightChar().getTimeZhi());
