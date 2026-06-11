// Writes hand-authored bilingual alt texts (Claude viewed every photo, 2026-06-11)
// and splits the Nassau photo into a new Bahamas gallery (GPS: 25.1, -77.3).
import { readFileSync, writeFileSync } from 'node:fs';

const alts = {
  // ---- China ----
  'china/IMG_20170731_154353.jpg': ["Thatched pavilions over a quiet pond at Du Fu's Thatched Cottage, Chengdu", '成都杜甫草堂，竹影环抱的池畔草亭'],
  'china/IMG_20170801_185249.jpg': ['Temple rooftops above a sea of clouds on Mount Emei', '峨眉山，云海之上的寺庙屋脊'],
  'china/IMG_20170803_174706.jpg': ['Evening light in a historic temple courtyard, Chengdu', '成都，古祠庭院的黄昏光线'],
  'china/IMG_20170805_132048.jpg': ['A giant panda settled into its bamboo lunch, Chengdu Panda Base', '成都大熊猫基地，抱着竹子大快朵颐的大熊猫'],
  'china/IMG_20180109_151113.jpg': ['Red-sailed wooden boats on a karst-ringed lake, Guilin', '桂林，喀斯特山影环绕的湖面与红帆木船'],
  'china/IMG_20181224_161823.jpg': ['Sunset behind Xinghai Bay Bridge, Dalian', '大连星海湾大桥的日落'],
  'china/IMG_20190104_102049.jpg': ['Painted gallery leading into Usnisa Palace, Niushou Mountain, Nanjing', '南京牛首山佛顶宫的彩绘长廊'],
  'china/IMG_20190104_110439.jpg': ['A gilded Buddha beyond a wall of engraved sutras, Usnisa Palace, Nanjing', '南京牛首山佛顶宫，经文墙尽头的鎏金佛像'],
  'china/IMG_20190818_112502.jpg': ['Crescent Lake oasis amid the Mingsha dunes, Dunhuang', '敦煌鸣沙山月牙泉，沙丘环抱的绿洲'],
  'china/IMG_20190818_151424.jpg': ['The nine-storey pavilion of the Mogao Caves, Dunhuang', '敦煌莫高窟九层楼'],
  'china/IMG_20190821_193909.jpg': ['Dusk over the salt flats of Chaka Salt Lake, Qinghai', '青海茶卡盐湖的暮色'],
  'china/IMG_20190825_123934.jpg': ['Colonial-era architecture from Qinhuangdao’s port-opening days', '秦皇岛开埠时期的欧式老建筑'],
  'china/IMG_20190825_164123.jpg': ['The 1899 heritage railway stop at Qinhuangdao', '秦皇岛 1899 年开埠地老站台'],
  'china/IMG_20190827_054513.jpg': ['Hazy sunrise over the Bohai Sea at Beidaihe', '北戴河，渤海上的朦胧日出'],
  'china/IMG_20190828_102631.jpg': ['An arched bridge among willows at the Chengde Mountain Resort', '承德避暑山庄，柳岸拱桥'],
  'china/IMG_20190829_094500.jpg': ['Sledgehammer Rock standing over Chengde', '承德磬锤峰'],
  // ---- Japan ----
  'japan/IMG_20191225_072604.jpg': ['A tawny owl perched at a Tokyo owl café', '东京猫头鹰咖啡馆里栖息的灰林鸮'],
  'japan/IMG_20191227_122409.jpg': ['The long wooden hall of Sanjūsangen-dō, Kyoto', '京都三十三间堂的悠长木构大殿'],
  'japan/IMG_20191227_163013.jpg': ['The vermilion gate and pagoda of Kiyomizu-dera, Kyoto', '京都清水寺的朱红仁王门与三重塔'],
  'japan/IMG_20191227_163225.jpg': ['Sun rays breaking over the Kyoto basin at dusk', '京都，黄昏时分穿透云层的霞光'],
  'japan/IMG_20191228_112104.jpg': ['Looking up through the Arashiyama bamboo grove', '岚山竹林，仰望竹梢间的天光'],
  'japan/IMG_20191228_151402.jpg': ['Kinkaku-ji, the Golden Pavilion, across its mirror pond', '金阁寺与镜湖池'],
  'japan/IMG_20191231_151741.jpg': ['Mount Fuji over the reeds of Lake Kawaguchi', '河口湖芦苇丛外的富士山'],
  // ---- Canada ----
  'canada/IMG20251103170736.jpg': ['Crimson sunset over north Toronto', '多伦多北郊的绯红日落'],
  'canada/IMG_20190111_163412.jpg': ['Winter sunset among ships at the Port of Toronto', '多伦多港，冬日落日下的货轮与吊臂'],
  'canada/IMG_20190518_054554.jpg': ['Dawn breaking over the Toronto skyline', '黎明粉霞下的多伦多天际线'],
  'canada/IMG_20201013_103019.jpg': ['Autumn sun glitter on Lake Ontario', '安大略湖的秋日波光'],
  'canada/IMG_20210904_150759.jpg': ['Still water and driftwood, Algonquin Provincial Park', '阿冈昆省立公园，静水与浮木'],
  'canada/IMG_20211217_110531.jpg': ['Winter Rockies panorama from Sulphur Mountain, Banff', '班夫硫磺山顶望落基山雪原'],
  'canada/IMG_20211217_122828.jpg': ['Banff townsite from above, wrapped in snow', '俯瞰雪中的班夫小镇'],
  'canada/IMG_20211219_130750.jpg': ['Skaters far out on frozen Lake Louise', '冰封路易斯湖上的滑冰人'],
  'canada/IMG_20211220_135153.jpg': ['A mountain creek threading through fresh snow, Banff', '班夫，新雪间蜿蜒的山涧'],
  'canada/IMG_20211221_130100.jpg': ['A frozen waterfall in the Canadian Rockies', '落基山间的冰瀑'],
  'canada/IMG_20220429_103038.jpg': ['Clear shallows at the Bruce Peninsula, Tobermory', '托伯莫里布鲁斯半岛的清澈浅滩'],
  'canada/IMG_20220504_134454.jpg': ['Cherry blossoms against a May sky, Toronto', '多伦多，五月晴空下的樱花'],
  'canada/IMG_20220507_145048.jpg': ['Horseshoe Falls and the mist boat, Niagara', '尼亚加拉马蹄瀑布与雾中游船'],
  'canada/IMG_20220720_152416.jpg': ['Montmorency Falls under a suspension bridge, Québec', '魁北克蒙莫朗西瀑布与悬索桥'],
  'canada/IMG_20220824_193935.jpg': ['Evening calm at Lake Louise', '路易斯湖的暮色'],
  'canada/IMG_20220826_143527.jpg': ['Spirit Island on Maligne Lake, Jasper', '贾斯珀玛琳湖的精灵岛'],
  // ---- United States ----
  'united_states/IMG_20180812_191438.jpg': ['Times Square neon at dusk, New York', '纽约时代广场，黄昏时分的霓虹'],
  'united_states/IMG_20180814_125058.jpg': ['The Statue of Liberty from New York Harbor', '纽约港上的自由女神像'],
  'united_states/IMG_20180815_094639.jpg': ['The Washington Monument before the Philadelphia Museum of Art', '费城艺术博物馆前的华盛顿纪念雕像'],
  'united_states/IMG_20180815_183852.jpg': ['The Lincoln Memorial in late-day light', '夕照中的林肯纪念堂'],
  'united_states/IMG_20180815_201955.jpg': ['The World War II Memorial glowing at dusk', '暮色中亮起的二战纪念碑'],
  'united_states/IMG_20231008_095801.jpg': ['The Hudson River from Riverside Park, New York', '纽约河滨公园望哈德逊河'],
  'united_states/IMG_20231008_164552.jpg': ['On the Brooklyn Bridge promenade, Manhattan behind', '布鲁克林大桥步道与曼哈顿天际线'],
  'united_states/IMG_20231009_072332.jpg': ['A cruise ship slips up the Hudson at dawn', '清晨哈德逊河上驶过的邮轮'],
  'united_states/IMG_20240520_091222.jpg': ['Morning surf at Miami Beach', '迈阿密海滩的清晨浪线'],
  'united_states/IMG20251014105901.jpg': ['The Golden Gate Bridge from the Marin Headlands', '马林岬角望金门大桥与旧金山'],
  'united_states/IMG20251015113347.jpg': ['Pacific surf along the San Mateo coast', '加州一号公路旁的太平洋海岸'],
  'united_states/IMG20251016144835.jpg': ['The Lone Cypress on 17-Mile Drive, Monterey', '蒙特雷十七里湾的孤柏'],
  'united_states/IMG20251018152242.jpg': ['Red-tile rooftops of Santa Barbara from the courthouse tower', '圣巴巴拉法院钟楼俯瞰红瓦屋顶与海岸'],
  'united_states/IMG20251019154938.jpg': ['Angels Flight, the tiny funicular in downtown LA', '洛杉矶市中心的天使铁路缆车'],
  'united_states/IMG20251019164631.jpg': ['The Hollywood Sign from the Griffith Observatory trails', '格里菲斯天文台山道远望好莱坞标志'],
  'united_states/IMG20251020160928.jpg': ['Santa Monica beach from the pier', '圣莫尼卡码头边的海滩'],
  // ---- Bahamas (split from US by GPS) ----
  'bahamas/IMG_20240519_131921.jpg': ["Cruise ships lined up at Nassau's Prince George Wharf", '拿骚太子乔治码头一字排开的邮轮'],
  // ---- United Kingdom ----
  'united_kingdom/IMG_20220816_094128.jpg': ['Honey-stone quadrangle gardens at an Oxford college', '牛津，学院蜜色石墙下的庭院'],
  'united_kingdom/IMG_20220817_134655.jpg': ["The Mathematical Bridge over the Cam, Cambridge", '剑桥康河上的数学桥'],
  'united_kingdom/IMG_20220817_155957.jpg': ["King's College Chapel from the Backs, Cambridge", '剑桥国王学院礼拜堂'],
  'united_kingdom/IMG_20220818_154917.jpg': ['The Albert Memorial, Kensington Gardens, London', '伦敦肯辛顿花园的阿尔伯特纪念亭'],
  'united_kingdom/IMG_20220818_163936.jpg': ['Buckingham Palace under summer clouds', '夏日云影下的白金汉宫'],
  'united_kingdom/IMG20250311132731.jpg': ['Clifton Suspension Bridge over the Avon Gorge, Bristol', '布里斯托，横跨埃文峡谷的克利夫顿悬索桥'],
  'united_kingdom/IMG20250411095855.jpg': ['Loch Lomond, mirror-still under morning haze', '晨雾中如镜的罗蒙湖'],
  'united_kingdom/IMG20250411191933.jpg': ['Church spires along the River Ness, Inverness', '因弗内斯，尼斯河畔的教堂尖顶'],
  'united_kingdom/IMG20250413163435.jpg': ['A train crossing the Forth Bridge, South Queensferry', '南昆斯费里，列车驶过福斯铁路桥'],
  'united_kingdom/IMG20250417124259.jpg': ['Spring blossoms below Arthur’s Seat, Edinburgh', '爱丁堡亚瑟王座山脚的春樱'],
  'united_kingdom/IMG20250417153258.jpg': ['The Old College dome from South Bridge, Edinburgh', '爱丁堡老学院圆顶街景'],
  'united_kingdom/IMG20250422112628.jpg': ['Tower Bridge and the Tower of London from the Thames', '泰晤士河上望伦敦塔桥与伦敦塔'],
  'united_kingdom/IMG20250424132120.jpg': ["St George's Chapel inside Windsor Castle", '温莎城堡圣乔治礼拜堂'],
  'united_kingdom/IMG20250901144148.jpg': ['A village church spire in the Cotswolds', '科茨沃尔德乡村教堂的尖顶'],
  'united_kingdom/IMG20250901163831.jpg': ['Thatched cottages along a Cotswolds lane', '科茨沃尔德小路旁的茅草石屋'],
  'united_kingdom/IMG20250904103825.jpg': ['Belfast City Hall and its copper domes', '贝尔法斯特市政厅与铜绿穹顶'],
  'united_kingdom/IMG20250905150757.jpg': ['The Changing of the Guard at Windsor Castle', '温莎城堡的卫兵换岗'],
  'united_kingdom/IMG20250906143131.jpg': ['Folded limestone at Stair Hole, Lulworth, Jurassic Coast', '侏罗纪海岸卢尔沃斯，斯泰尔洞的褶皱岩层'],
  'united_kingdom/IMG20250906154133.jpg': ["Man O'War Bay's chalk cliffs, Dorset", '多塞特，Man O’War 湾的白垩悬崖'],
  'united_kingdom/IMG20250909160437.jpg': ['Greenwich Park: the Old Royal Naval College against Canary Wharf', '格林尼治公园，旧皇家海军学院与金丝雀码头同框'],
};

const data = JSON.parse(readFileSync('src/data/photos.json', 'utf8'));

// 1. Split Nassau photo into a Bahamas gallery
const us = data.find((c) => c.id === 'united_states');
const nassauIdx = us.items.findIndex((i) => i.src === 'IMG_20240519_131921.jpg');
if (nassauIdx !== -1) {
  const [nassau] = us.items.splice(nassauIdx, 1);
  data.push({ id: 'bahamas', name: 'Bahamas', nameZh: '巴哈马', lat: 25.0, lng: -77.4, items: [nassau] });
}

// 2. Apply alts
let applied = 0, missing = [];
for (const c of data) {
  for (const item of c.items) {
    const key = `${c.id}/${item.src}`;
    if (alts[key]) {
      item.alt = alts[key][0];
      item.altZh = alts[key][1];
      applied++;
    } else {
      missing.push(key);
    }
  }
}

writeFileSync('src/data/photos.json', JSON.stringify(data, null, 2));
console.log(`alts applied: ${applied}; missing: ${missing.length}`);
missing.forEach((m) => console.log('  MISSING:', m));
console.log('countries:', data.map((c) => `${c.name}(${c.items.length})`).join(', '));
