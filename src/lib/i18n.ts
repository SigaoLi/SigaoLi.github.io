// Locale helpers + hand-written UI strings (machine translation is only for
// long-form content; UI copy is authored bilingually here).

export type Lang = 'en' | 'zh';

export const localizePath = (lang: Lang, path: string) => {
  const clean = path.startsWith('/zh/') ? path.slice(3) : path === '/zh' ? '/' : path;
  return lang === 'zh' ? (clean === '/' ? '/zh/' : `/zh${clean}`) : clean;
};

/** The same page in the other language (for the toggle + hreflang). */
export const altPath = (path: string) =>
  path.startsWith('/zh/') || path === '/zh'
    ? localizePath('en', path)
    : localizePath('zh', path);

export const ui = {
  en: {
    nav: { home: 'Home', work: 'Work', cv: 'CV', lens: 'Through My Lens', toggleTheme: 'Toggle theme', menu: 'Open menu', lang: '中文' },
    footer: { built: 'Designed to deployed — entirely vibe-coded.', photoRights: 'All photographs © Sigao Li, all rights reserved.', privacy: 'Privacy' },
    chat: {
      open: 'Chat with Zoe about Sigao',
      bubble: 'Meow~ welcome! Got questions about Sigao? Ask me!',
      meow: 'Meow~',
      title: "Zoe · Sigao's Cat",
      subtitle: 'The royal cat knows everything about her human — just ask.',
      greeting: "Meow~ I'm Zoe, Sigao's royal cat! What would you like to know about my human? Work, projects, photos… I've got all the intel, purr-fectly organized!",
      placeholder: 'Ask me anything, meow…',
      send: 'Send',
      disclaimer: 'AI-generated — even cats err. Confirm important matters by email.',
      privacy: 'Privacy',
      forget: 'Forget me',
      forgotten: "Poof — forgotten, meow. We'll meet fresh next time.",
      close: 'Close chat',
      errRate: 'Paws too fast, meow — wait a minute and try again.',
      errTurns: 'This chat hit its limit — I need a nap. Start a fresh one below, meow.',
      errUpstream: 'My brain is napping (service unavailable) — try again later, meow.',
      errNetwork: 'The network yarn snapped — please retry, meow.',
      reset: 'New chat',
      suggestions: [
        'What does your human do right now?',
        'What are his best projects?',
        'What is his tech stack?',
        'How can I reach him?',
      ],
      guide: { work: 'See his work →', cv: 'Browse his CV →', photography: 'Wander the photos →', email: 'Email him ✉', caseTpl: 'Read the case: %s →', cvTpl: 'Find %s on his CV →' },
      welcomeBack: 'Welcome back, %s! 😺 What can I dig up for you today?',
      askName: 'We meet again, meow~ I never did catch your name — what should I call you?',
      nameAck: 'Got it — %s it is, meow. So, what would you like to know about Sigao?',
      namePlaceholder: 'Your name',
      nameOk: 'Tell Zoe',
      nameNo: 'No thanks',
      nameDeclined: "Okay meow — I won't ask again.",
    },
    hero: {
      coords: '31.2304° N, 121.4737° E — AND COUNTING',
      tagline: 'AI Product Manager · Spatial Data Scientist',
      narrative: 'From maps to models, and the products in between.',
      viewWork: 'View Work',
      lensLink: 'Through My Lens →',
      scroll: 'SCROLL',
    },
    arc: [
      { label: 'ACT I — GEOGRAPHY', coords: '43.6532° N, 79.3832° W', place: 'Toronto, 2018–2023', title: 'Points on a map', body: 'Six years of geographic analysis — mapping retail networks, public health and crime across the Toronto CMA, and learning that every location is a decision.' },
      { label: 'ACT II — BUSINESS', coords: '51.4545° N, 2.5879° W', place: 'Bristol, 2024–2025', title: 'Points on a chart', body: 'An MSc in Business Analytics, consulting with IBM on AI-driven financial analysis, and a growing pull toward quantitative finance.' },
      { label: 'ACT III — AI', coords: '31.2304° N, 121.4737° E', place: 'Shanghai, 2026—', title: 'Points in a network', body: 'Building AI products at Ebest Mobile — agents, LLM pipelines, and the systems that ship them. Three disciplines, one through-line: points, and the patterns between them.' },
    ],
    featured: { coords: 'Selected work', title: 'The products in between', all: 'All work →' },
    about: {
      coords: 'About', title: 'A geographer who ships',
      p1: "I'm an AI product manager with geospatial roots. My path runs from six years of geographic analysis in Toronto, through business analytics in Bristol — including consulting with IBM on AI-driven financial analysis — to building AI products at Ebest Mobile in Shanghai today. I serve as Director of GISource at",
      p1b: ', advancing GIS education worldwide, and I keep one foot in quantitative finance.',
      p2a: "I hold an MSc in Business Analytics from the University of Bristol, a Master's in Spatial Analysis and a BA in Geographic Analysis from Toronto Metropolitan University, with professional certifications in AI (University of Toronto) and Data Science (University of Waterloo). When I'm not building, I'm usually behind a camera somewhere new — see",
      p2b: '.',
      lensName: 'Through My Lens', fullCv: 'Full CV →', portraitAlt: 'Portrait of Sigao Li',
    },
    work: {
      title: 'Work — Sigao Li', desc: 'Case studies in AI products, geospatial data systems and business analytics by Sigao Li.',
      coords: 'Selected work · 2022—2026', h1: 'Case studies',
      intro: "Five systems I've designed and shipped — AI agents, LLM pipelines and data platforms, told the way a product manager thinks: challenge, approach, impact.",
      researchCoords: 'Academic', researchTitle: 'Research interests',
      indexCoords: 'Index', indexTitle: 'More projects',
      allWork: '← ALL WORK', viewSource: 'View source ↗',
      roles: { personal: 'Personal project', lead: 'Led design & development', team: 'Team project' },
    },
    cv: {
      title: 'CV — Sigao Li', desc: 'Curriculum vitae of Sigao Li — AI Product Manager with a geospatial and business analytics background.',
      kicker: 'Curriculum vitae',
      intro: 'AI Product Manager at Ebest Mobile, Shanghai — built on six years of geographic analysis and an MSc in Business Analytics.',
      download: 'Download PDF', present: 'Present',
      sections: { experience: ['Career', 'Professional experience'], research: ['Research', 'Research assistantships'], education: ['Education', 'Academic background'], volunteering: ['Community', 'Volunteering & GISphere'], awards: ['Recognition', 'Honors & awards'], skills: ['Toolkit', 'Skills & certifications'] },
      skillGroups: { data: 'Data & Engineering', frameworks: 'ML Frameworks', tools: 'Tools', certifications: 'Certifications' },
    },
    lens: {
      title: 'Through My Lens — Sigao Li',
      h1: 'Through My Lens',
      intro: 'I travel with a camera. Each dot below is a place that stayed with me — click one to see what I saw there.',
      countries: 'countries', photographs: 'photographs', photos: 'photos',
      mapAria: 'World map showing photographed countries',
      viewLarger: 'View larger', closeViewer: 'Close viewer', prev: 'Previous photo', next: 'Next photo',
    },
    notFound: { title: '404 — Off the map', sub: 'OFF THE MAP — NO COORDINATES FOUND', back: '← Back to known territory' },
    cmdk: { placeholder: 'Search pages, work, links…', empty: 'No results — try “work” or “photo”', toggleTheme: 'Toggle theme', themeHint: 'Light / dark' },
  },
  zh: {
    nav: { home: '首页', work: '作品', cv: '简历', lens: '镜头之下', toggleTheme: '切换主题', menu: '打开菜单', lang: 'EN' },
    footer: { built: '从设计到上线，全程 vibe coding。', photoRights: '所有摄影作品 © 李思高，保留所有权利。', privacy: '隐私说明' },
    chat: {
      open: '找驺虞聊聊思高',
      bubble: '喵呀～欢迎！有关于思高的问题，都可以来问我！',
      meow: '喵~',
      title: '驺虞 · 思高的猫',
      subtitle: '御用大猫掌握主人的一手情报，尽管问。',
      greeting: '喵呀～我是驺虞，思高的御用大猫！你想打听他的什么喵？工作、项目、照片……本猫掌握一手情报，用小鱼干就能换！',
      placeholder: '想问什么喵…',
      send: '发送',
      disclaimer: 'AI 生成（猫也会出错），重要事项请以邮件与本人确认。',
      privacy: '隐私',
      forget: '忘记我',
      forgotten: '噗——本猫把你忘了喵，下次重新认识。',
      close: '关闭对话',
      errRate: '爪速太快了喵——休息一分钟再来。',
      errTurns: '聊得太久本猫要去打盹了——点下方重新开聊喵。',
      errUpstream: '本猫暂时联系不上大脑（服务不可用），稍后再试喵。',
      errNetwork: '网络毛线团断了喵，请重试。',
      reset: '重新开聊',
      suggestions: ['你家主人现在做什么工作喵？', '他最拿得出手的项目是什么？', '他的技术栈是什么？', '怎么联系他？'],
      guide: { work: '看看主人的作品 →', cv: '翻翻他的简历 →', photography: '逛逛「镜头之下」→', email: '给主人发邮件 ✉', caseTpl: '看看案例「%s」→', cvTpl: '去简历找「%s」→' },
      welcomeBack: '%s，你回来啦喵～今天想打听点什么？',
      askName: '又见面啦喵～上次忘了问，你怎么称呼？',
      nameAck: '记住啦，%s 喵～那你想了解思高的什么？',
      namePlaceholder: '怎么称呼',
      nameOk: '告诉驺虞',
      nameNo: '不用啦',
      nameDeclined: '好哒，不问啦喵～',
    },
    hero: {
      coords: '31.2304° N, 121.4737° E — 足迹仍在继续',
      tagline: 'AI 产品经理 · 空间数据科学家',
      narrative: '始于地图，行至模型，产品生于其间。',
      viewWork: '查看作品',
      lensLink: '镜头之下 →',
      scroll: '向下滚动',
    },
    arc: [
      { label: '第一幕 — 地理', coords: '43.6532° N, 79.3832° W', place: '多伦多，2018–2023', title: '地图上的点', body: '六年地理分析——为大多伦多地区绘制零售网络、公共健康与犯罪地图，并由此懂得：每一个位置，都是一个决策。' },
      { label: '第二幕 — 商业', coords: '51.4545° N, 2.5879° W', place: '布里斯托，2024–2025', title: '图表上的点', body: '布里斯托大学商业分析硕士，与 IBM 合作 AI 驱动的财务分析，并日益被量化金融吸引。' },
      { label: '第三幕 — AI', coords: '31.2304° N, 121.4737° E', place: '上海，2026—', title: '网络中的点', body: '在意鹰科技（Ebest Mobile）打造 AI 产品——智能体、LLM 管线，以及让它们落地的系统。三种学科，一条暗线：散落的点，和点与点之间的秩序。' },
    ],
    featured: { coords: '精选作品', title: '生于其间的产品', all: '全部作品 →' },
    about: {
      coords: '关于', title: '一个会交付的地理人',
      p1: '我是一名有地理空间背景的 AI 产品经理。我的路径从多伦多六年的地理分析出发，经过布里斯托的商业分析（包括与 IBM 合作的 AI 财务分析项目），走到今天在上海意鹰科技打造 AI 产品。我担任',
      p1b: ' GISource 总监，推动 GIS 教育在全球的发展，同时保持着对量化金融的探索。',
      p2a: '我拥有布里斯托大学商业分析硕士学位、多伦多都会大学空间分析硕士与地理分析学士学位，并持有多伦多大学人工智能、滑铁卢大学数据科学专业证书。不写代码不画原型的时候，我多半正背着相机在某个陌生的地方——欢迎来',
      p2b: '看看。',
      lensName: '镜头之下', fullCv: '完整简历 →', portraitAlt: '李思高的肖像',
    },
    work: {
      title: '作品 — 李思高', desc: '李思高的 AI 产品、地理空间数据系统与商业分析案例集。',
      coords: '精选作品 · 2022—2026', h1: '案例研究',
      intro: '五个我设计并交付的系统——AI 智能体、LLM 管线与数据平台，用产品经理的方式讲述：挑战、方法、影响。',
      researchCoords: '学术', researchTitle: '研究方向',
      indexCoords: '索引', indexTitle: '更多项目',
      allWork: '← 全部作品', viewSource: '查看源码 ↗',
      roles: { personal: '个人项目', lead: '主导设计与开发', team: '团队项目' },
    },
    cv: {
      title: '简历 — 李思高', desc: '李思高的简历——拥有地理空间与商业分析背景的 AI 产品经理。',
      kicker: '个人简历',
      intro: '上海意鹰科技 AI 产品经理——以六年地理分析经验与商业分析硕士学位为基础。',
      download: '下载 PDF', present: '至今',
      sections: { experience: ['履历', '专业经历'], research: ['研究经历', '研究经历'], education: ['教育', '教育背景'], volunteering: ['社区', '志愿服务'], awards: ['荣誉', '获奖经历'], skills: ['工具箱', '技能证书'] },
      skillGroups: { data: '数据与工程', frameworks: '机器学习框架', tools: '工具', certifications: '证书' },
    },
    lens: {
      title: '镜头之下 — 李思高',
      h1: '镜头之下',
      intro: '我带着相机旅行。下面的每个点，都是一个留在我记忆里的地方——点击它，看看我在那里看到了什么。',
      countries: '个国家', photographs: '张照片', photos: '张',
      mapAria: '标注拍摄国家的世界地图',
      viewLarger: '查看大图', closeViewer: '关闭查看器', prev: '上一张', next: '下一张',
    },
    notFound: { title: '404 — 地图之外', sub: '已离开地图 — 未找到坐标', back: '← 返回已知疆域' },
    cmdk: { placeholder: '搜索页面、作品、链接…', empty: '无结果——试试「作品」或「摄影」', toggleTheme: '切换主题', themeHint: '深浅模式' },
  },
} as const;

export const t = (lang: Lang) => ui[lang];
