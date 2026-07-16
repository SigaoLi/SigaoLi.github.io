// 同源层 · 摄影足迹 — 从 photos.json 生成统计摘要 + 每张的画面描述(照片数自动跟随,消除素材里手写数字漂移)。
// 描述=灯箱同款 alt 文案(站点本就公开),给 Zoe 真实素材回答"最喜欢哪张"类问题,
// 否则模型只有城市名清单,会给照片编画面与故事(07-16 Sigao 报告的幻觉 bug)。
// 隐私:只输出城市级地名/数量/画面描述,不含精确坐标与图片本体(与镜头之下页面公开粒度一致)。
import photosData from '../../data/photos.json';

interface RawCountry {
  name: string;
  nameZh: string;
  items: { city?: string; cityZh?: string; alt?: string; altZh?: string }[];
}

export interface PhotoSummary {
  totalPhotos: number;
  countries: { name: string; photos: number; cities: string[]; descriptions: string[] }[];
}

export function loadPhotoSummary(lang: 'en' | 'zh'): PhotoSummary {
  const countries = (photosData as RawCountry[]).map((c) => ({
    name: lang === 'zh' ? c.nameZh : c.name,
    photos: c.items.length,
    cities: [...new Set(c.items.map((i) => (lang === 'zh' ? i.cityZh : i.city)).filter((x): x is string => !!x))],
    descriptions: c.items.map((i) => (lang === 'zh' ? i.altZh : i.alt)).filter((x): x is string => !!x),
  }));
  return {
    totalPhotos: countries.reduce((sum, c) => sum + c.photos, 0),
    countries,
  };
}
