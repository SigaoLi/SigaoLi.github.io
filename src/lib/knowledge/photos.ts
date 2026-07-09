// 同源层 · 摄影足迹 — 从 photos.json 生成统计摘要(照片数自动跟随,消除素材里手写数字漂移)。
// 隐私:只输出城市级地名与数量,不含精确坐标与图片本体(与镜头之下页面公开粒度一致)。
import photosData from '../../data/photos.json';

interface RawCountry {
  name: string;
  nameZh: string;
  items: { city?: string; cityZh?: string }[];
}

export interface PhotoSummary {
  totalPhotos: number;
  countries: { name: string; photos: number; cities: string[] }[];
}

export function loadPhotoSummary(lang: 'en' | 'zh'): PhotoSummary {
  const countries = (photosData as RawCountry[]).map((c) => ({
    name: lang === 'zh' ? c.nameZh : c.name,
    photos: c.items.length,
    cities: [...new Set(c.items.map((i) => (lang === 'zh' ? i.cityZh : i.city)).filter((x): x is string => !!x))],
  }));
  return {
    totalPhotos: countries.reduce((sum, c) => sum + c.photos, 0),
    countries,
  };
}
