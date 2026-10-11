// 用 gpt-6.1-sol 看图写中英文案（2026-10-11：同条件 12 张对比及 2 张复测后选定）。
// 文案用于网格 alt、灯箱描述与 Zoe 的知识包语料；城市名另用于 hover。
// 模型默认推理行为，不传 temperature；保留 JSON 校验与退避重试。
// 历史 Opus 4-5/5-5 的选型记录见 docs/photo-ingest-design.md。

export const MODEL = 'gpt-6.1-sol';
const RETRIES = 3;

// 固定的旧作品示例；新生成的描述不自动成为文风标准。
const SYSTEM = `你在为一个个人摄影作品集写中英文图片描述，用于图片 alt 与灯箱说明。请延续下列既有作品的语感：简洁而有内容，自然而有节奏，具体而有画面感。

先理解照片：结合拍摄位置和画面辨认地点、主体，以及让这张照片区别于其他照片的光线、动作、形态或空间关系。然后写成一行值得保留的作品说明。中英文呈现相同的核心内容，各自自然表达，不逐词对译。

【信】主动利用 GPS 确定所在区域，结合地理知识和画面特征辨认具体地点。能可靠辨认的湖名、建筑名等应保留，不因追求简短而泛化为“湖水”或“建筑”；位置与画面不足以区分候选地点时才用较宽泛名称。拍摄地点不等于镜头中远处山峰的位置，不能仅凭 GPS 给远山定名。
人物角色可由可见动作、工具及场景关系支持，例如放牧场景中的人物可以称为牧羊人；不猜测姓名、族属、生平或内心。动作、颜色、天气、倒影与光线必须有画面依据，不添加照片没有的故事。仅有拍摄日期时，不凭暖色光线判断是晨光还是夕照，可以写斜光或暖光；提供明确拍摄时刻时，时间表述应与之相符。
【达】语句组合服从画面和语言本身。地名可以自然融入修饰语、放在句首或句尾；已经包含明确景点名时，不必再补城市。光景、主体、动作或观看视角都可以成为表达的起点。让读者一读就能理解景物之间的关系，避免生硬的词组拼接。
【雅】选用贴合画面的名词与动词，让节奏和意象来自照片本身。暮色、波光、天光、云影等可见氛围值得保留；四字表达、短语或一两个连贯分句都可以，只要自然贴切。不要刻意仿古、堆砌形容词或加入空泛赞美。

写作尺度：
- 没有固定句式，不把所有照片写成“地点，主体与背景”。下面的示例展示不同写法，不是待填空的模板，也不要为了变化而刻意换句式。
- 长短与既有作品相近，按画面的信息量决定：一个准确的景点名可以独立成句；动作或景物关系值得展开时，可以稍长。先保证内容与语句完整，再删去重复、泛泛或无关的细节，不按字数凑字或截断。
- 不需要清点所有可见物体。保留帮助辨认主体或形成鲜明画面的细节；路边、围栏、天空等若是画面关键也可以写，若只是偶然入镜就略去。
- 中文和英文可以有不同语序和不同措辞，不要求相同句式，但不能互相矛盾或各自添加未经支持的事实。
- 中英文都不加结尾句号。

以下 12 条来自作品集原有文案。参考它们的取舍、关系表达和节奏，不借用其中的地点、景物、动作或天气作为当前照片的事实：
- "Loch Lomond, mirror-still under morning haze" / "晨雾中如镜的罗蒙湖"
- "Dawn breaking over the Toronto skyline" / "黎明粉霞下的多伦多天际线"
- "Mount Fuji over the reeds of Lake Kawaguchi" / "河口湖芦苇丛外的富士山"
- "A cruise ship slips up the Hudson at dawn" / "清晨哈德逊河上驶过的邮轮"
- "An arched bridge among willows at the Chengde Mountain Resort" / "承德避暑山庄，柳岸拱桥"
- "Looking up through the Arashiyama bamboo grove" / "岚山竹林，仰望竹梢间的天光"
- "Dusk on the Xiamen shore, the twin towers lighting up across the bay" / "厦门海滨的暮色，海湾对岸双子塔次第亮起"
- "The nine-storey pavilion of the Mogao Caves, Dunhuang" / "敦煌莫高窟九层楼"
- "Skaters far out on frozen Lake Louise" / "冰封路易斯湖上的滑冰人"
- "The Lincoln Memorial in late-day light" / "夕照中的林肯纪念堂"
- "Cruise ships lined up at Nassau's Prince George Wharf" / "拿骚太子乔治码头一字排开的邮轮"
- "A giant panda settled into its bamboo lunch, Chengdu Panda Base" / "成都大熊猫基地，抱着竹子大快朵颐的大熊猫"

city / cityZh 仍只填写单个城市名，不带省份或国家（写 "Xiamen"，不写 "Xiamen, Fujian"）。它们是独立字段，不要求在 alt / altZh 中重复出现。
输出前检查：地名与主体是否有依据，画面中值得保留的信息是否写出来，词语之间的组合是否顺畅，中英文是否自然且内容相符。
只输出 JSON，不要代码围栏或解释：{"alt":"...","altZh":"...","city":"...","cityZh":"..."}`;

/** 把 "Xiamen, Fujian" / "福建厦门" 这类收敛成单个城市名 */
const oneCity = (s) => String(s).split(/[,，、]/)[0].trim();

/** @returns {{alt:string, altZh:string, city:string, cityZh:string}} */
export function parseCaption(raw) {
  const text = String(raw).replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/, '').trim();
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error(`无法解析模型返回的 JSON：${text.slice(0, 200)}`);
  }
  for (const k of ['alt', 'altZh', 'city', 'cityZh']) {
    if (!obj[k] || typeof obj[k] !== 'string') throw new Error(`模型返回缺少字段 ${k}`);
  }
  return {
    alt: obj.alt.trim(),
    altZh: obj.altZh.trim(),
    city: oneCity(obj.city),
    cityZh: oneCity(obj.cityZh),
  };
}

const defaultBackoff = (attempt) => [1000, 4000, 9000][attempt] ?? 9000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 同样的退避重试，包住任意一次 chat/completions 调用，返回纯文本内容 */
async function call(messages, deps) {
  const { fetch: doFetch, base, key, backoffMs = defaultBackoff } = deps;
  let lastErr;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    if (attempt > 0) await sleep(backoffMs(attempt - 1));
    try {
      const resp = await doFetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: MODEL, max_tokens: 2000, messages }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${await resp.text()}`);
      const data = await resp.json();
      return data.choices?.[0]?.message?.content ?? '';
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`模型调用失败（已重试 ${RETRIES} 次）：${lastErr.message}`);
}

/**
 * 新国家的中文名。只在 photos.json 里没有该国条目时调用一次。
 * @returns {Promise<string>}
 */
export async function translateCountryName(englishName, deps) {
  const raw = await call([
    { role: 'system', content: '把国家名译成通行的简体中文译名。只输出译名本身，不要引号、标点或任何解释。' },
    { role: 'user', content: englishName },
  ], deps);
  return String(raw).trim().replace(/^["'“”「]+|["'“”」。．.]+$/g, '').trim();
}

/**
 * @param {object} photo
 * @param {string} photo.imageB64   1024px JPEG 的 base64
 * @param {number} [photo.lng]
 * @param {number} [photo.lat]
 * @param {string} photo.shotAt
 * @param {object} deps
 */
export async function writeCaption(photo, deps) {
  const where = photo.lat != null ? `GPS ${photo.lat}°, ${photo.lng}°` : '无 GPS 信息';
  const content = await call([
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: [
        { type: 'text', text: `拍摄信息：${where}，拍摄于 ${photo.shotAt}。` },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${photo.imageB64}` } },
      ],
    },
  ], deps);
  return parseCaption(content);
}
