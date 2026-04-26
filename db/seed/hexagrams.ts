import { listHexagrams } from "@/lib/meihua/hexagrams";

/**
 * 64 卦 seed 数据（spec §3.6 hexagrams 表）
 *
 * - number / name / upper / lower / wuxing 由 lib/meihua/hexagrams.ts 推导
 * - judgment（卦辞）按通行本 1-2 句精简
 * - image（大象辞）+ lines（爻辞）暂留占位，由 W4 meihua.interpret prompt 任务补齐
 *
 * 算法层（W3）只需要 number + name + 上下卦 + 五行用于推演；judgment / image / lines
 * 是 prompt 模板输入，由 W4 任务把传统典籍内容补全后整张表 onConflictDoUpdate 重灌
 */

const JUDGMENT_BY_NUMBER: Record<number, string> = {
  1: "元亨利贞。",
  2: "元亨，利牝马之贞。先迷后得主，利。",
  3: "元亨利贞。勿用有攸往，利建侯。",
  4: "亨。匪我求童蒙，童蒙求我。",
  5: "有孚，光亨，贞吉。利涉大川。",
  6: "有孚窒惕，中吉，终凶。利见大人，不利涉大川。",
  7: "贞，丈人吉，无咎。",
  8: "吉。原筮，元永贞，无咎。",
  9: "亨。密云不雨，自我西郊。",
  10: "履虎尾，不咥人，亨。",
  11: "小往大来，吉，亨。",
  12: "否之匪人，不利君子贞，大往小来。",
  13: "同人于野，亨。利涉大川，利君子贞。",
  14: "元亨。",
  15: "亨，君子有终。",
  16: "利建侯行师。",
  17: "元亨利贞，无咎。",
  18: "元亨，利涉大川。",
  19: "元亨利贞。至于八月有凶。",
  20: "盥而不荐，有孚顒若。",
  21: "亨。利用狱。",
  22: "亨。小利有攸往。",
  23: "不利有攸往。",
  24: "亨。出入无疾，朋来无咎。",
  25: "元亨利贞。其匪正有眚，不利有攸往。",
  26: "利贞。不家食吉，利涉大川。",
  27: "贞吉。观颐，自求口实。",
  28: "栋桡，利有攸往，亨。",
  29: "习坎，有孚，维心亨，行有尚。",
  30: "利贞，亨。畜牝牛吉。",
  31: "亨，利贞，取女吉。",
  32: "亨，无咎，利贞，利有攸往。",
  33: "亨，小利贞。",
  34: "利贞。",
  35: "康侯用锡马蕃庶，昼日三接。",
  36: "利艰贞。",
  37: "利女贞。",
  38: "小事吉。",
  39: "利西南，不利东北。利见大人，贞吉。",
  40: "利西南，无所往，其来复吉。有攸往，夙吉。",
  41: "有孚，元吉，无咎，可贞，利有攸往。",
  42: "利有攸往，利涉大川。",
  43: "扬于王庭，孚号有厉，告自邑，不利即戎，利有攸往。",
  44: "女壮，勿用取女。",
  45: "亨。王假有庙，利见大人，亨，利贞。",
  46: "元亨。用见大人，勿恤，南征吉。",
  47: "亨，贞，大人吉，无咎。有言不信。",
  48: "改邑不改井，无丧无得，往来井井。",
  49: "巳日乃孚，元亨利贞，悔亡。",
  50: "元吉，亨。",
  51: "亨。震来虩虩，笑言哑哑。震惊百里，不丧匕鬯。",
  52: "艮其背，不获其身，行其庭，不见其人。无咎。",
  53: "女归吉，利贞。",
  54: "征凶，无攸利。",
  55: "亨，王假之，勿忧，宜日中。",
  56: "小亨，旅贞吉。",
  57: "小亨。利有攸往，利见大人。",
  58: "亨，利贞。",
  59: "亨。王假有庙，利涉大川，利贞。",
  60: "亨。苦节不可贞。",
  61: "豚鱼吉，利涉大川，利贞。",
  62: "亨，利贞。可小事，不可大事。",
  63: "亨小，利贞。初吉终乱。",
  64: "亨。小狐汔济，濡其尾，无攸利。",
};

export interface HexagramRow {
  number: number;
  name: string;
  upper_trigram: string;
  lower_trigram: string;
  upper_wuxing: string;
  lower_wuxing: string;
  judgment: string;
  image: string;
  lines: string; // JSON
}

export const HEXAGRAMS_SEED: readonly HexagramRow[] = listHexagrams().map((h) => ({
  number: h.number,
  name: h.name,
  upper_trigram: h.upper,
  lower_trigram: h.lower,
  upper_wuxing: h.upperWuxing,
  lower_wuxing: h.lowerWuxing,
  judgment: JUDGMENT_BY_NUMBER[h.number] ?? "（卦辞 W4 补）",
  image: "（象辞 W4 补）",
  lines: JSON.stringify(["", "", "", "", "", ""]),
}));
