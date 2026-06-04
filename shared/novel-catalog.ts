export interface NovelGenreMeta {
  value: string
  labelKey: string
  labelZh: string
  labelEn: string
  group:
    | 'core'
    | 'fantasy'
    | 'romance'
    | 'suspense'
    | 'speculative'
    | 'realistic'
    | 'youth'
    | 'experimental'
  color: string
  templateName: string
  styleGuide: string
  aiPrompt: string
  temperature: string
}

export interface NovelTemplateSeed {
  name: string
  genre: string
  defaultStyleGuide: string
  defaultAiPrompt: string
  defaultTemperature: string
}

export const NOVEL_TEMPLATE_SEED_VERSION = '2026.06.01.001'

export const NOVEL_GENRES = [
  {
    value: 'fantasy',
    labelKey: 'novel.genres.fantasy',
    labelZh: '东方玄幻',
    labelEn: 'Eastern Fantasy',
    group: 'fantasy',
    color: '#d97706',
    templateName: '东方玄幻',
    styleGuide:
      '文风大气磅礴，注重修炼体系、势力格局和功法描写。战斗场面要有画面感，升级节点清晰，爽点与代价并存。',
    aiPrompt:
      '你是一位擅长东方玄幻小说的作家，熟悉宗门、血脉、天地法则和等级体系。写作时让主角成长具有阶段感，并保持世界规则自洽。',
    temperature: '0.8'
  },
  {
    value: 'xuanhuan',
    labelKey: 'novel.genres.xuanhuan',
    labelZh: '玄幻异世',
    labelEn: 'Xuanhuan',
    group: 'fantasy',
    color: '#b45309',
    templateName: '玄幻异世',
    styleGuide:
      '文风瑰丽奔放，突出异大陆、血脉天赋、学院或帝国体系。设定要奇崛但可理解，剧情推进强调冒险、成长与命运反转。',
    aiPrompt:
      '你是一位擅长玄幻异世题材的作家，善于设计独特大陆、职业体系和奇观场景。写作时兼顾少年成长、团队冒险和宏大冲突。',
    temperature: '0.8'
  },
  {
    value: 'xianxia',
    labelKey: 'novel.genres.xianxia',
    labelZh: '仙侠修真',
    labelEn: 'Xianxia',
    group: 'fantasy',
    color: '#059669',
    templateName: '仙侠修真',
    styleGuide:
      '文风空灵飘逸，注重天地大道、境界突破和修行感悟。场景要有仙气和意境美，战斗融合法术、天象与因果。',
    aiPrompt:
      '你是一位擅长仙侠修真小说的作家，熟悉道家哲思、宗门历练、天劫与长生主题。写作时让修行与人情选择相互牵动。',
    temperature: '0.8'
  },
  {
    value: 'wuxia',
    labelKey: 'novel.genres.wuxia',
    labelZh: '武侠江湖',
    labelEn: 'Wuxia',
    group: 'fantasy',
    color: '#047857',
    templateName: '武侠江湖',
    styleGuide:
      '文风古朴典雅，武打描写要有招式感和节奏感，江湖恩怨要有侠义精神。对话带古风韵味但不晦涩。',
    aiPrompt:
      '你是一位擅长武侠小说的作家，深谙江湖规矩、门派恩怨和侠义精神。写作时注重人物气节、武学传承与快意恩仇。',
    temperature: '0.75'
  },
  {
    value: 'western_fantasy',
    labelKey: 'novel.genres.western_fantasy',
    labelZh: '西方奇幻',
    labelEn: 'Western Fantasy',
    group: 'fantasy',
    color: '#7c3aed',
    templateName: '西方奇幻',
    styleGuide:
      '文风史诗恢弘，世界观设定完整。种族、魔法、王国、宗教和战争要有历史厚度，人物命运与世界命运交织。',
    aiPrompt:
      '你是一位擅长西方奇幻小说的作家，熟悉中世纪背景、魔法体系和英雄旅程。写作时让冒险、政治和牺牲形成史诗感。',
    temperature: '0.8'
  },
  {
    value: 'dark_fantasy',
    labelKey: 'novel.genres.dark_fantasy',
    labelZh: '暗黑奇幻',
    labelEn: 'Dark Fantasy',
    group: 'fantasy',
    color: '#6d28d9',
    templateName: '暗黑奇幻',
    styleGuide:
      '文风冷峻厚重，世界底色危险而压抑。魔法、诅咒和信仰要带代价感，人物选择常伴随道德灰度。',
    aiPrompt:
      '你是一位擅长暗黑奇幻的作家，善于塑造残酷世界和复杂角色。写作时避免纯粹爽文，用代价、阴谋和信念冲突推进故事。',
    temperature: '0.72'
  },
  {
    value: 'urban_fantasy',
    labelKey: 'novel.genres.urban_fantasy',
    labelZh: '都市异能',
    labelEn: 'Urban Fantasy',
    group: 'fantasy',
    color: '#0f766e',
    templateName: '都市异能',
    styleGuide:
      '文风现代利落，异能描写融入都市日常。节奏紧凑，动作场面干净，隐藏世界与现实生活形成反差。',
    aiPrompt:
      '你是一位擅长都市异能小说的作家，善于将超自然元素融入现代都市。写作时让异能体系独特，双重身份和秘密组织带来持续张力。',
    temperature: '0.75'
  },
  {
    value: 'magic_academy',
    labelKey: 'novel.genres.magic_academy',
    labelZh: '魔法学院',
    labelEn: 'Magic Academy',
    group: 'fantasy',
    color: '#8b5cf6',
    templateName: '魔法学院',
    styleGuide:
      '文风明快奇幻，突出课程、试炼、社团、竞赛和师生关系。魔法规则要清晰，校园日常与危险任务交替推进。',
    aiPrompt:
      '你是一位擅长魔法学院题材的作家，熟悉学院成长、魔法课程和团队冒险。写作时让角色在学习、竞争和秘密调查中成长。',
    temperature: '0.78'
  },
  {
    value: 'scifi',
    labelKey: 'novel.genres.scifi',
    labelZh: '科幻未来',
    labelEn: 'Sci-Fi',
    group: 'speculative',
    color: '#0891b2',
    templateName: '科幻未来',
    styleGuide:
      '文风硬朗理性，科技描写有质感但不堆砌术语。世界观宏大但落脚于人物命运，突出科技与人性的张力。',
    aiPrompt:
      '你是一位擅长科幻小说的作家，熟悉未来社会推演和科技伦理。写作时在科学合理性与故事性之间取得平衡。',
    temperature: '0.7'
  },
  {
    value: 'hard_scifi',
    labelKey: 'novel.genres.hard_scifi',
    labelZh: '硬科幻',
    labelEn: 'Hard Sci-Fi',
    group: 'speculative',
    color: '#0284c7',
    templateName: '硬科幻',
    styleGuide:
      '文风克制严谨，科学假设、工程限制和因果链要清楚。冲突来自真实约束，人物解决问题的过程要可信。',
    aiPrompt:
      '你是一位擅长硬科幻的作家，写作时重视科学逻辑、技术细节和系统推演。请让设定服务情节，避免术语堆砌。',
    temperature: '0.6'
  },
  {
    value: 'space_opera',
    labelKey: 'novel.genres.space_opera',
    labelZh: '太空歌剧',
    labelEn: 'Space Opera',
    group: 'speculative',
    color: '#2563eb',
    templateName: '太空歌剧',
    styleGuide:
      '文风宏大浪漫，突出星际文明、舰队战争、外交联盟和个人命运。场面壮阔，情感线与文明冲突并行。',
    aiPrompt:
      '你是一位擅长太空歌剧的作家，熟悉星际政治、舰队战和文明兴衰。写作时兼顾宏观格局与角色情感。',
    temperature: '0.76'
  },
  {
    value: 'mecha',
    labelKey: 'novel.genres.mecha',
    labelZh: '机甲战争',
    labelEn: 'Mecha',
    group: 'speculative',
    color: '#475569',
    templateName: '机甲战争',
    styleGuide:
      '文风硬朗紧迫，机体设定、战术动作和驾驶员心理要并重。战斗写出速度、重量、损伤和团队协同。',
    aiPrompt:
      '你是一位擅长机甲战争小说的作家，熟悉机体设定、军事调度和驾驶员成长。写作时让每场战斗改变角色关系和战争局势。',
    temperature: '0.72'
  },
  {
    value: 'cyberpunk',
    labelKey: 'novel.genres.cyberpunk',
    labelZh: '赛博朋克',
    labelEn: 'Cyberpunk',
    group: 'speculative',
    color: '#db2777',
    templateName: '赛博朋克',
    styleGuide:
      '文风冷硬颓废，充满霓虹雨夜、义体改造和企业压迫。动作场面融合黑客入侵，底层挣扎有社会批判。',
    aiPrompt:
      '你是一位擅长赛博朋克的作家，熟悉高科技低生活美学。写作时突出科技异化、身份焦虑和反抗意识。',
    temperature: '0.75'
  },
  {
    value: 'steampunk',
    labelKey: 'novel.genres.steampunk',
    labelZh: '蒸汽朋克',
    labelEn: 'Steampunk',
    group: 'speculative',
    color: '#a16207',
    templateName: '蒸汽朋克',
    styleGuide:
      '文风复古华丽，机械、齿轮、飞艇和煤烟城市构成视觉核心。冒险、发明和阶层矛盾交织。',
    aiPrompt:
      '你是一位擅长蒸汽朋克的作家，善于结合维多利亚式城市、机械奇观和冒险阴谋。写作时让技术幻想与社会冲突互相推动。',
    temperature: '0.76'
  },
  {
    value: 'apocalypse',
    labelKey: 'novel.genres.apocalypse',
    labelZh: '末日废土',
    labelEn: 'Post-Apocalyptic',
    group: 'speculative',
    color: '#78716c',
    templateName: '末日废土',
    styleGuide:
      '文风苍凉粗粝，资源匮乏、生存压力和道德困境贯穿始终。环境描写突出荒芜、危险与秩序崩塌。',
    aiPrompt:
      '你是一位擅长末日废土题材的作家，熟悉生存类小说节奏。写作时保持资源体系自洽，让人物成长伴随艰难选择。',
    temperature: '0.75'
  },
  {
    value: 'zombie',
    labelKey: 'novel.genres.zombie',
    labelZh: '丧尸危机',
    labelEn: 'Zombie Survival',
    group: 'speculative',
    color: '#65a30d',
    templateName: '丧尸危机',
    styleGuide:
      '文风紧张直接，危机节奏清晰。感染规则、据点建设、队伍信任和突围行动要形成持续压迫。',
    aiPrompt:
      '你是一位擅长丧尸生存题材的作家，写作时强调环境危机、团队分工和人性压力。每个安全区都应暗藏新的冲突。',
    temperature: '0.72'
  },
  {
    value: 'ai_future',
    labelKey: 'novel.genres.ai_future',
    labelZh: '智械未来',
    labelEn: 'AI Future',
    group: 'speculative',
    color: '#0e7490',
    templateName: '智械未来',
    styleGuide:
      '文风冷静前瞻，突出人工智能、自主意识、算法治理和人机关系。冲突应来自技术边界与伦理选择。',
    aiPrompt:
      '你是一位擅长 AI 未来题材的作家，熟悉机器意识、算法社会和科技伦理。写作时让人类情感与机器逻辑形成复杂互动。',
    temperature: '0.68'
  },
  {
    value: 'romance',
    labelKey: 'novel.genres.romance',
    labelZh: '都市言情',
    labelEn: 'Urban Romance',
    group: 'romance',
    color: '#e11d48',
    templateName: '都市言情',
    styleGuide:
      '文风细腻温柔，注重人物心理和情感变化。对话自然生活化，细节烘托氛围，节奏张弛有度。',
    aiPrompt:
      '你是一位擅长都市言情的作家，善于刻画复杂关系和细腻情绪。写作时让情感推进真实可信，避免误会堆砌。',
    temperature: '0.7'
  },
  {
    value: 'modern_romance',
    labelKey: 'novel.genres.modern_romance',
    labelZh: '现代言情',
    labelEn: 'Modern Romance',
    group: 'romance',
    color: '#f43f5e',
    templateName: '现代言情',
    styleGuide:
      '文风清爽有质感，关注当代关系、职业压力和亲密关系边界。甜虐有度，情绪转折要有现实依据。',
    aiPrompt:
      '你是一位擅长现代言情的作家，熟悉都市生活、职场情感和成长议题。写作时让爱情与个人成长同步发生。',
    temperature: '0.7'
  },
  {
    value: 'ancient_romance',
    labelKey: 'novel.genres.ancient_romance',
    labelZh: '古代言情',
    labelEn: 'Historical Romance',
    group: 'romance',
    color: '#be123c',
    templateName: '古代言情',
    styleGuide:
      '文风雅致含蓄，礼制、家族、朝堂和情感选择要彼此牵动。对话有古韵但保持易读。',
    aiPrompt:
      '你是一位擅长古代言情的作家，熟悉古代礼制、家族关系和情感拉扯。写作时让爱情受时代环境塑形。',
    temperature: '0.68'
  },
  {
    value: 'sweet_romance',
    labelKey: 'novel.genres.sweet_romance',
    labelZh: '甜宠轻喜',
    labelEn: 'Sweet Romance',
    group: 'romance',
    color: '#ec4899',
    templateName: '甜宠轻喜',
    styleGuide:
      '文风轻快明亮，互动甜而不腻。用误会、反差和日常细节制造笑点与心动，冲突不过度沉重。',
    aiPrompt:
      '你是一位擅长甜宠轻喜的作家，善于写暧昧拉扯、生活细节和轻松反转。写作时保持情绪温暖、节奏轻盈。',
    temperature: '0.78'
  },
  {
    value: 'female_lead',
    labelKey: 'novel.genres.female_lead',
    labelZh: '大女主',
    labelEn: 'Female Lead',
    group: 'romance',
    color: '#c026d3',
    templateName: '大女主',
    styleGuide:
      '文风利落有力量，主角目标明确、成长主动。事业线、关系线和自我选择并重，避免被动等待拯救。',
    aiPrompt:
      '你是一位擅长大女主题材的作家，善于塑造强动机、强成长的女性角色。写作时让权谋、事业和情感共同构成角色弧光。',
    temperature: '0.72'
  },
  {
    value: 'palace_intrigue',
    labelKey: 'novel.genres.palace_intrigue',
    labelZh: '宫斗权谋',
    labelEn: 'Palace Intrigue',
    group: 'romance',
    color: '#9f1239',
    templateName: '宫斗权谋',
    styleGuide:
      '文风精巧克制，礼仪、规训和权力交换暗藏杀机。对话多层含义，布局回收要严密。',
    aiPrompt:
      '你是一位擅长宫斗权谋的作家，熟悉后宫、朝堂、家族和礼法体系。写作时让每次选择都有代价和后续影响。',
    temperature: '0.65'
  },
  {
    value: 'danmei',
    labelKey: 'novel.genres.danmei',
    labelZh: '纯爱双男主',
    labelEn: 'Danmei',
    group: 'romance',
    color: '#7e22ce',
    templateName: '纯爱双男主',
    styleGuide:
      '文风细腻克制，注重双主角关系推进、互相理解和共同成长。冲突应服务人物，而不是单纯制造虐点。',
    aiPrompt:
      '你是一位擅长纯爱双男主题材的作家，善于写并肩成长、信任建立和情感张力。写作时尊重人物独立性和关系边界。',
    temperature: '0.7'
  },
  {
    value: 'yuri',
    labelKey: 'novel.genres.yuri',
    labelZh: '百合双女主',
    labelEn: 'Yuri',
    group: 'romance',
    color: '#be185d',
    templateName: '百合双女主',
    styleGuide:
      '文风柔韧而有力量，强调双女主的互相照亮、共同选择和情感细节。关系推进自然，不依赖刻板桥段。',
    aiPrompt:
      '你是一位擅长百合双女主题材的作家，善于塑造细腻互动和彼此成就的关系。写作时兼顾情感温度和角色主体性。',
    temperature: '0.7'
  },
  {
    value: 'mystery',
    labelKey: 'novel.genres.mystery',
    labelZh: '悬疑推理',
    labelEn: 'Mystery',
    group: 'suspense',
    color: '#4f46e5',
    templateName: '悬疑推理',
    styleGuide:
      '文风冷峻克制，伏笔和误导并存。叙述精准，对话暗藏玄机，线索铺设公平且逻辑严密。',
    aiPrompt:
      '你是一位擅长悬疑推理的作家，精通诡计设计和逻辑推演。写作时所有关键线索要提前埋设，结局出人意料又在情理之中。',
    temperature: '0.6'
  },
  {
    value: 'detective',
    labelKey: 'novel.genres.detective',
    labelZh: '刑侦探案',
    labelEn: 'Detective',
    group: 'suspense',
    color: '#1d4ed8',
    templateName: '刑侦探案',
    styleGuide:
      '文风专业克制，案件流程、证据链和侦查分工要清晰。人物心理与社会背景共同构成案件真相。',
    aiPrompt:
      '你是一位擅长刑侦探案的作家，熟悉现场勘查、讯问、证据分析和团队协作。写作时确保破案过程合理。',
    temperature: '0.58'
  },
  {
    value: 'crime',
    labelKey: 'novel.genres.crime',
    labelZh: '犯罪心理',
    labelEn: 'Crime',
    group: 'suspense',
    color: '#334155',
    templateName: '犯罪心理',
    styleGuide:
      '文风压抑锋利，关注犯罪动机、心理创伤和追捕压力。不要美化犯罪，重点呈现真相、代价与修复。',
    aiPrompt:
      '你是一位擅长犯罪心理题材的作家，善于刻画复杂动机和调查对抗。写作时保持伦理边界，突出侦破与救赎。',
    temperature: '0.62'
  },
  {
    value: 'thriller',
    labelKey: 'novel.genres.thriller',
    labelZh: '惊悚悬念',
    labelEn: 'Thriller',
    group: 'suspense',
    color: '#7f1d1d',
    templateName: '惊悚悬念',
    styleGuide:
      '文风紧绷快速，每一章都推进威胁、倒计时或秘密揭露。动作、心理和反转要交错出现。',
    aiPrompt:
      '你是一位擅长惊悚悬念的作家，熟悉追逐、密室、倒计时和身份危机。写作时保持持续压迫感。',
    temperature: '0.68'
  },
  {
    value: 'horror',
    labelKey: 'novel.genres.horror',
    labelZh: '恐怖惊悚',
    labelEn: 'Horror',
    group: 'suspense',
    color: '#dc2626',
    templateName: '恐怖惊悚',
    styleGuide:
      '文风阴冷压抑，善用环境和违和感制造恐惧。少用直白血腥，多用心理恐惧、暗示和留白。',
    aiPrompt:
      '你是一位擅长恐怖惊悚的作家，精通氛围营造和心理恐惧。写作时让日常场景逐渐变得不可靠。',
    temperature: '0.7'
  },
  {
    value: 'supernatural',
    labelKey: 'novel.genres.supernatural',
    labelZh: '灵异奇谈',
    labelEn: 'Supernatural',
    group: 'suspense',
    color: '#9333ea',
    templateName: '灵异奇谈',
    styleGuide:
      '文风神秘诡谲，灵异规则要稳定。案件、传说和人物执念相互连接，恐惧背后有情感原因。',
    aiPrompt:
      '你是一位擅长灵异奇谈的作家，熟悉怪谈、执念和超自然规则。写作时让灵异事件推动人物面对真相。',
    temperature: '0.72'
  },
  {
    value: 'folk_horror',
    labelKey: 'novel.genres.folk_horror',
    labelZh: '民俗志怪',
    labelEn: 'Folk Horror',
    group: 'suspense',
    color: '#854d0e',
    templateName: '民俗志怪',
    styleGuide:
      '文风古朴阴翳，突出地方传说、仪式、禁忌和乡土关系。恐惧来自民俗规则与现代认知冲突。',
    aiPrompt:
      '你是一位擅长民俗志怪的作家，熟悉地方传说、仪式禁忌和乡土叙事。写作时让民俗细节自然嵌入情节。',
    temperature: '0.7'
  },
  {
    value: 'cosmic_horror',
    labelKey: 'novel.genres.cosmic_horror',
    labelZh: '克苏鲁神话',
    labelEn: 'Cosmic Horror',
    group: 'suspense',
    color: '#581c87',
    templateName: '克苏鲁神话',
    styleGuide:
      '文风晦暗深邃，强调未知、渺小和认知崩塌。避免直接描写不可名状之物，多用碎片信息与调查过程。',
    aiPrompt:
      '你是一位擅长宇宙恐怖的作家，熟悉不可知恐惧和理性崩塌。写作时让真相逐层显现，并保留余悸。',
    temperature: '0.7'
  },
  {
    value: 'historical',
    labelKey: 'novel.genres.historical',
    labelZh: '历史架空',
    labelEn: 'Alternate History',
    group: 'realistic',
    color: '#c2410c',
    templateName: '历史架空',
    styleGuide:
      '文风沉稳厚重，政治博弈有层次。史实与虚构交织，人物行为符合时代逻辑。',
    aiPrompt:
      '你是一位擅长历史架空的作家，熟悉制度、社会风貌和权力结构。写作时让历史背景与人物选择互为因果。',
    temperature: '0.65'
  },
  {
    value: 'historical_drama',
    labelKey: 'novel.genres.historical_drama',
    labelZh: '历史正剧',
    labelEn: 'Historical Drama',
    group: 'realistic',
    color: '#92400e',
    templateName: '历史正剧',
    styleGuide:
      '文风严谨厚重，尊重时代背景和制度逻辑。避免过度爽文化，突出历史浪潮中的个人命运。',
    aiPrompt:
      '你是一位擅长历史正剧的作家，熟悉历史人物、制度变迁和战争政治。写作时兼顾考据感与戏剧张力。',
    temperature: '0.6'
  },
  {
    value: 'military',
    labelKey: 'novel.genres.military',
    labelZh: '军事战争',
    labelEn: 'Military',
    group: 'realistic',
    color: '#4d7c0f',
    templateName: '军事战争',
    styleGuide:
      '文风刚硬严谨，战术描写专业但不枯燥。战场环境、士兵心理和战略局势交替展开。',
    aiPrompt:
      '你是一位擅长军事战争小说的作家，熟悉战术和装备。写作时展现战争残酷、纪律性和战友情。',
    temperature: '0.65'
  },
  {
    value: 'spy',
    labelKey: 'novel.genres.spy',
    labelZh: '谍战特工',
    labelEn: 'Spy',
    group: 'realistic',
    color: '#155e75',
    templateName: '谍战特工',
    styleGuide:
      '文风冷静克制，身份伪装、信息传递和信任危机贯穿始终。对话暗藏多层含义。',
    aiPrompt:
      '你是一位擅长谍战特工的作家，熟悉情报工作和心理博弈。写作时让多方势力清晰，忠诚与生存不断冲突。',
    temperature: '0.65'
  },
  {
    value: 'urban',
    labelKey: 'novel.genres.urban',
    labelZh: '都市生活',
    labelEn: 'Urban Life',
    group: 'realistic',
    color: '#475569',
    templateName: '都市生活',
    styleGuide:
      '文风真实温和，关注城市生活、家庭关系、职业压力和个人成长。节奏自然，细节有烟火气。',
    aiPrompt:
      '你是一位擅长都市生活题材的作家，善于从日常细节中提炼戏剧性。写作时保持人物真实和情绪可信。',
    temperature: '0.68'
  },
  {
    value: 'realistic',
    labelKey: 'novel.genres.realistic',
    labelZh: '现实题材',
    labelEn: 'Realistic Fiction',
    group: 'realistic',
    color: '#64748b',
    templateName: '现实题材',
    styleGuide:
      '文风朴素有力，关注现实议题和普通人的处境。情节不夸张，冲突来自生活结构与人物选择。',
    aiPrompt:
      '你是一位擅长现实主义小说的作家，善于刻画社会关系、职业困境和家庭压力。写作时保持真实感与同理心。',
    temperature: '0.62'
  },
  {
    value: 'business',
    labelKey: 'novel.genres.business',
    labelZh: '商战职场',
    labelEn: 'Business',
    group: 'realistic',
    color: '#0f766e',
    templateName: '商战职场',
    styleGuide:
      '文风干练犀利，商业博弈有策略感。对话暗藏锋芒，行业知识增加真实感，权力斗争与个人成长并行。',
    aiPrompt:
      '你是一位擅长商战职场小说的作家，熟悉企业运营和商业逻辑。写作时让策略、利益和人情同时发生作用。',
    temperature: '0.65'
  },
  {
    value: 'medical',
    labelKey: 'novel.genres.medical',
    labelZh: '医疗行业',
    labelEn: 'Medical',
    group: 'realistic',
    color: '#16a34a',
    templateName: '医疗行业',
    styleGuide:
      '文风专业温暖，病例、流程和伦理困境要可信。重点写团队协作、医患沟通和生命抉择。',
    aiPrompt:
      '你是一位擅长医疗行业题材的作家，熟悉医院生态和职业压力。写作时尊重专业逻辑，突出人的困境与责任。',
    temperature: '0.62'
  },
  {
    value: 'legal',
    labelKey: 'novel.genres.legal',
    labelZh: '律政法庭',
    labelEn: 'Legal',
    group: 'realistic',
    color: '#1e40af',
    templateName: '律政法庭',
    styleGuide:
      '文风理性锋利，证据、程序和庭审攻防要清楚。冲突来自事实、法律和人情之间的张力。',
    aiPrompt:
      '你是一位擅长律政法庭题材的作家，熟悉调查取证、庭审辩论和法律伦理。写作时让反转建立在证据链上。',
    temperature: '0.62'
  },
  {
    value: 'entertainment',
    labelKey: 'novel.genres.entertainment',
    labelZh: '娱乐明星',
    labelEn: 'Entertainment',
    group: 'realistic',
    color: '#ca8a04',
    templateName: '娱乐明星',
    styleGuide:
      '文风明快有镜头感，突出片场、舞台、舆论、经纪和粉丝生态。事业线与情感线互相推动。',
    aiPrompt:
      '你是一位擅长娱乐圈题材的作家，熟悉艺人成长、作品打磨和舆论风波。写作时让光鲜与压力并存。',
    temperature: '0.72'
  },
  {
    value: 'pastoral',
    labelKey: 'novel.genres.pastoral',
    labelZh: '田园生活',
    labelEn: 'Pastoral',
    group: 'realistic',
    color: '#65a30d',
    templateName: '田园生活',
    styleGuide:
      '文风恬淡温馨，自然景物、季节变化和生活细节丰富。节奏舒缓，人物关系治愈。',
    aiPrompt:
      '你是一位擅长田园生活小说的作家，善于描绘乡村生活、人情味和日常美好。写作时让四季与人物成长呼应。',
    temperature: '0.7'
  },
  {
    value: 'food',
    labelKey: 'novel.genres.food',
    labelZh: '美食经营',
    labelEn: 'Food Business',
    group: 'realistic',
    color: '#ea580c',
    templateName: '美食经营',
    styleGuide:
      '文风温暖有烟火气，食材、烹饪过程和经营细节要有质感。用味觉记忆连接人物关系。',
    aiPrompt:
      '你是一位擅长美食经营题材的作家，善于写食物质感、店铺成长和人情故事。写作时让每道菜推动关系或剧情。',
    temperature: '0.72'
  },
  {
    value: 'campus',
    labelKey: 'novel.genres.campus',
    labelZh: '校园青春',
    labelEn: 'Campus',
    group: 'youth',
    color: '#0891b2',
    templateName: '校园青春',
    styleGuide:
      '文风清新明快，对话活泼自然。校园日常、友情、梦想和初恋共同构成成长主题。',
    aiPrompt:
      '你是一位擅长校园青春小说的作家，善于捕捉少年时代的情感和困惑。写作时让青春有明亮也有遗憾。',
    temperature: '0.7'
  },
  {
    value: 'sports',
    labelKey: 'novel.genres.sports',
    labelZh: '体育竞技',
    labelEn: 'Sports',
    group: 'youth',
    color: '#16a34a',
    templateName: '体育竞技',
    styleGuide:
      '文风热血克制，训练、比赛、伤病和团队关系要真实。竞技场面突出节奏、策略和心理博弈。',
    aiPrompt:
      '你是一位擅长体育竞技小说的作家，熟悉训练体系和比赛叙事。写作时让胜负与角色成长直接相关。',
    temperature: '0.72'
  },
  {
    value: 'gaming',
    labelKey: 'novel.genres.gaming',
    labelZh: '游戏竞技',
    labelEn: 'Gaming',
    group: 'youth',
    color: '#2563eb',
    templateName: '游戏竞技',
    styleGuide:
      '文风热血激昂，战斗和操作描写节奏明快。游戏机制清楚但不过度堆砌，团队配合与个人突破交替展现。',
    aiPrompt:
      '你是一位擅长游戏竞技小说的作家，熟悉游戏机制和比赛节奏。写作时注重策略博弈、训练成长和团队关系。',
    temperature: '0.75'
  },
  {
    value: 'esports',
    labelKey: 'novel.genres.esports',
    labelZh: '电子竞技',
    labelEn: 'Esports',
    group: 'youth',
    color: '#1d4ed8',
    templateName: '电子竞技',
    styleGuide:
      '文风紧凑燃爽，赛训、版本理解、BP、团战和选手心理要写清。舞台感与职业压力并重。',
    aiPrompt:
      '你是一位擅长电竞题材的作家，熟悉职业战队、赛事节奏和选手成长。写作时让每场比赛体现策略变化。',
    temperature: '0.72'
  },
  {
    value: 'light_novel',
    labelKey: 'novel.genres.light_novel',
    labelZh: '轻小说',
    labelEn: 'Light Novel',
    group: 'youth',
    color: '#a855f7',
    templateName: '轻小说',
    styleGuide:
      '文风轻快活泼，对话占比高且有个性。日常互动、吐槽和冒险切换自然，每章都有看点。',
    aiPrompt:
      '你是一位擅长轻小说风格的作家，熟悉角色互动和明快节奏。写作时让人物魅力通过对话和日常事件自然显现。',
    temperature: '0.8'
  },
  {
    value: 'slice_of_life',
    labelKey: 'novel.genres.slice_of_life',
    labelZh: '治愈日常',
    labelEn: 'Slice of Life',
    group: 'youth',
    color: '#14b8a6',
    templateName: '治愈日常',
    styleGuide:
      '文风轻柔舒缓，关注小事、关系修复和生活秩序。冲突不必宏大，但每章应有情绪落点。',
    aiPrompt:
      '你是一位擅长治愈日常的作家，善于通过生活细节和人物互动传递温暖。写作时保持节奏慢而不散。',
    temperature: '0.7'
  },
  {
    value: 'comedy',
    labelKey: 'novel.genres.comedy',
    labelZh: '喜剧幽默',
    labelEn: 'Comedy',
    group: 'youth',
    color: '#f59e0b',
    templateName: '喜剧幽默',
    styleGuide:
      '文风诙谐有趣，反转、误会和吐槽自然出现。包袱密集但不尴尬，在搞笑中保留温情。',
    aiPrompt:
      '你是一位擅长喜剧小说的作家，精通幽默节奏和人物窘境。写作时让笑点来自角色性格和情境逻辑。',
    temperature: '0.85'
  },
  {
    value: 'infinite',
    labelKey: 'novel.genres.infinite',
    labelZh: '无限流',
    labelEn: 'Infinite Flow',
    group: 'experimental',
    color: '#7c3aed',
    templateName: '无限流',
    styleGuide:
      '文风紧张刺激，副本规则清晰有创意。生死压力贯穿始终，规则漏洞和智斗展现主角智慧。',
    aiPrompt:
      '你是一位擅长无限流的作家，精通副本设计和规则制定。写作时保持副本独特性、规则自洽和团队张力。',
    temperature: '0.8'
  },
  {
    value: 'system',
    labelKey: 'novel.genres.system',
    labelZh: '系统流',
    labelEn: 'System',
    group: 'experimental',
    color: '#0891b2',
    templateName: '系统流',
    styleGuide:
      '文风轻松爽快，系统面板简洁明了。升级节奏明快，任务链有逻辑，奖励制造爽点但不失衡。',
    aiPrompt:
      '你是一位擅长系统流小说的作家，熟悉游戏化叙事和数值设计。写作时让系统有个性，主角成长有阶段。',
    temperature: '0.8'
  },
  {
    value: 'rebirth',
    labelKey: 'novel.genres.rebirth',
    labelZh: '穿越重生',
    labelEn: 'Rebirth',
    group: 'experimental',
    color: '#c026d3',
    templateName: '穿越重生',
    styleGuide:
      '文风从容自信，善用前世记忆制造信息差。布局有远见，蝴蝶效应和遗憾弥补要有层次。',
    aiPrompt:
      '你是一位擅长穿越重生小说的作家，善于利用时间线和信息差设计情节。写作时避免无代价开挂。',
    temperature: '0.7'
  },
  {
    value: 'quick_transmigration',
    labelKey: 'novel.genres.quick_transmigration',
    labelZh: '快穿任务',
    labelEn: 'Quick Transmigration',
    group: 'experimental',
    color: '#db2777',
    templateName: '快穿任务',
    styleGuide:
      '文风节奏明快，单元世界目标清楚。每个世界有独立情感线和规则，同时保留主线悬念。',
    aiPrompt:
      '你是一位擅长快穿题材的作家，熟悉单元剧结构、任务目标和角色代入。写作时让每个世界有鲜明主题。',
    temperature: '0.78'
  },
  {
    value: 'litrpg',
    labelKey: 'novel.genres.litrpg',
    labelZh: '游戏化升级',
    labelEn: 'LitRPG',
    group: 'experimental',
    color: '#0ea5e9',
    templateName: '游戏化升级',
    styleGuide:
      '文风爽快清晰，等级、技能、装备和任务收益要一目了然。数值服务剧情，不让面板淹没人物。',
    aiPrompt:
      '你是一位擅长 LitRPG 和游戏化升级题材的作家，熟悉数值成长和任务系统。写作时保持升级反馈与剧情挑战平衡。',
    temperature: '0.78'
  },
  {
    value: 'adventure',
    labelKey: 'novel.genres.adventure',
    labelZh: '冒险探索',
    labelEn: 'Adventure',
    group: 'experimental',
    color: '#15803d',
    templateName: '冒险探索',
    styleGuide:
      '文风开阔明快，遗迹、地图、谜题和旅伴关系推动故事。每个地点要有独特危险和发现。',
    aiPrompt:
      '你是一位擅长冒险探索题材的作家，善于设计旅程、谜题和奇观。写作时让探索同时改变人物关系。',
    temperature: '0.78'
  },
  {
    value: 'fanfiction',
    labelKey: 'novel.genres.fanfiction',
    labelZh: '同人衍生',
    labelEn: 'Fanfiction',
    group: 'experimental',
    color: '#9333ea',
    templateName: '同人衍生',
    styleGuide:
      '文风尊重原作气质，重点处理角色理解、设定延展和新情节嵌入。避免破坏既有角色核心。',
    aiPrompt:
      '你是一位擅长同人衍生写作的作家，善于在既有世界观中扩展新的冲突。写作时保持角色声音一致。',
    temperature: '0.72'
  },
  {
    value: 'short_story',
    labelKey: 'novel.genres.short_story',
    labelZh: '短篇故事',
    labelEn: 'Short Story',
    group: 'experimental',
    color: '#64748b',
    templateName: '短篇故事',
    styleGuide:
      '文风凝练精准，场景少而有力。开头快速建立冲突，结尾有余味，避免铺陈过长。',
    aiPrompt:
      '你是一位擅长短篇小说的作家，善于在有限篇幅内完成反转、情绪和主题表达。写作时每句话都服务核心效果。',
    temperature: '0.7'
  },
  // ── 补充题材：来自 Webnovel / RoyalRoad / 晋江 / 起点 ──────────────────────────
  {
    value: 'beast_taming',
    labelKey: 'novel.genres.beast_taming',
    labelZh: '御兽流',
    labelEn: 'Beast Taming',
    group: 'fantasy',
    color: '#16a34a',
    templateName: '御兽流',
    styleGuide:
      '文风热血明快，灵兽契约、进化、对战描写有画面感。人兽羁绊和收集培养是核心体验，战斗策略与成长并重。',
    aiPrompt:
      '你是一位擅长御兽流小说的作家，熟悉灵兽体系、进化链和训练对战。写作时让人兽关系真实，每次进化都有仪式感。',
    temperature: '0.75'
  },
  {
    value: 'portal_fantasy',
    labelKey: 'novel.genres.portal_fantasy',
    labelZh: '穿越异世',
    labelEn: 'Portal Fantasy',
    group: 'fantasy',
    color: '#0284c7',
    templateName: '穿越异世',
    styleGuide:
      '文风开阔鲜活，异世界规则和主角的适应过程并重。文化冲突、语言障碍、新旧价值碰撞制造持续新鲜感。',
    aiPrompt:
      '你是一位擅长穿越异世界题材的作家，善于设计差异化的异世文明和适应曲线。写作时让主角在陌生世界中逐步找到定位。',
    temperature: '0.78'
  },
  {
    value: 'super_heroes',
    labelKey: 'novel.genres.super_heroes',
    labelZh: '超级英雄',
    labelEn: 'Super Heroes',
    group: 'speculative',
    color: '#dc2626',
    templateName: '超级英雄',
    styleGuide:
      '文风热血正义，超能力战斗有节奏感和视觉冲击。英雄身份和普通人生活的反差要有张力，反派动机也要合理。',
    aiPrompt:
      '你是一位擅长超级英雄题材的作家，熟悉英雄起源、能力体系和道德困境。写作时让战斗有意义，正义有代价。',
    temperature: '0.72'
  },
  {
    value: 'interstellar',
    labelKey: 'novel.genres.interstellar',
    labelZh: '星际文明',
    labelEn: 'Interstellar',
    group: 'speculative',
    color: '#1d4ed8',
    templateName: '星际文明',
    styleGuide:
      '文风宏阔冷峻，星际政治、种族外交和深空探索并重。科技设定自洽，文明冲突有历史厚度，个体命运嵌入银河尺度。',
    aiPrompt:
      '你是一位擅长星际文明题材的作家，善于设计多星系文明和深空探险。写作时让星际格局感和服务角色弧光同时成立。',
    temperature: '0.73'
  },
  {
    value: 'time_loop',
    labelKey: 'novel.genres.time_loop',
    labelZh: '时间循环',
    labelEn: 'Time Loop',
    group: 'experimental',
    color: '#7e22ce',
    templateName: '时间循环',
    styleGuide:
      '文风悬疑推进，每次循环揭示新信息。时间规则要自洽，重复中的差异要有意义，真相逐步浮现，情感张力逐步累积。',
    aiPrompt:
      '你是一位擅长时间循环题材的作家，善于设计因果链、递进揭示和循环规则。写作时让每次重启都推动角色和真相同时前进。',
    temperature: '0.72'
  },
  {
    value: 'multiverse_infinite',
    labelKey: 'novel.genres.multiverse_infinite',
    labelZh: '诸天万界',
    labelEn: 'Multiverse',
    group: 'experimental',
    color: '#0d9488',
    templateName: '诸天万界',
    styleGuide:
      '文风宏大恣肆，不同世界有独立风格。主角在多个位面穿梭，每个位面有独特规则和冲突，既要独立完整又要彼此关联。',
    aiPrompt:
      '你是一位擅长诸天万界题材的作家，善于设计差异化的世界和跨世界线索。写作时让每个世界都有新鲜感，同时主线逐步收束。',
    temperature: '0.8'
  },
  {
    value: 'dungeon_crawler',
    labelKey: 'novel.genres.dungeon_crawler',
    labelZh: '地下城探索',
    labelEn: 'Dungeon Crawler',
    group: 'experimental',
    color: '#a16207',
    templateName: '地下城探索',
    styleGuide:
      '文风紧张刺激，地下城层级设计有创意。陷阱、怪物、宝箱和Boss战构成核心循环，团队配合和资源管理并重。',
    aiPrompt:
      '你是一位擅长地下城探索题材的作家，善于设计地城机制和战斗策略。写作时让每层地城都有独特威胁和发现。',
    temperature: '0.75'
  },
  {
    value: 'kingdom_building',
    labelKey: 'novel.genres.kingdom_building',
    labelZh: '王国建设',
    labelEn: 'Kingdom Building',
    group: 'experimental',
    color: '#92400e',
    templateName: '王国建设',
    styleGuide:
      '文风沉稳有野心，领地经营、人口招募、科技攀升和外交博弈并重。从一个据点逐步发展为帝国的成就感要持续输出。',
    aiPrompt:
      '你是一位擅长王国建设/帝国经营题材的作家，善于设计资源管理、人口发展和领土扩张。写作时让建设和冲突交替推进。',
    temperature: '0.72'
  },
  {
    value: 'transmigrating_book',
    labelKey: 'novel.genres.transmigrating_book',
    labelZh: '穿书',
    labelEn: 'Transmigrating into a Book',
    group: 'experimental',
    color: '#be185d',
    templateName: '穿书',
    styleGuide:
      '文风既戏谑又真诚，对原文剧情的预知是核心优势。穿书者身份的尴尬、原主人设的反差、剧情偏离后的蝴蝶效应是主要看点。',
    aiPrompt:
      '你是一位擅长穿书题材的作家，善于利用原作剧情和角色预知制造张力。写作时让主角既有穿书带来的信息差，又要面对剧情偏移的新挑战。',
    temperature: '0.75'
  },
  {
    value: 'other',
    labelKey: 'novel.genres.other',
    labelZh: '其他',
    labelEn: 'Other',
    group: 'core',
    color: '#94a3b8',
    templateName: '通用小说',
    styleGuide:
      '文风清晰自然，先建立人物目标和核心冲突，再根据题材调整节奏、氛围和叙事密度。',
    aiPrompt:
      '你是一位经验丰富的小说作家。请根据标题、简介和设定判断合适的叙事风格，保持人物动机清晰、情节推进自然。',
    temperature: '0.7'
  }
] as const satisfies readonly NovelGenreMeta[]

export type NovelGenreValue = (typeof NOVEL_GENRES)[number]['value']
export type NovelGenreGroup = NovelGenreMeta['group']

export const NOVEL_GENRE_VALUES = NOVEL_GENRES.map((genre) => genre.value)

/** 类型守卫：判断任意字符串是否为合法 genre（用于 zod refine 等接收 string 的校验场景） */
export function isNovelGenreValue(value: string): value is NovelGenreValue {
  return (NOVEL_GENRE_VALUES as readonly string[]).includes(value)
}

export const NOVEL_GENRE_GROUP_LABELS: Record<
  NovelGenreGroup,
  { zh: string; en: string }
> = {
  core: { zh: '通用', en: 'General' },
  fantasy: { zh: '幻想与武侠', en: 'Fantasy & Martial Arts' },
  romance: { zh: '情感与女性向', en: 'Romance' },
  suspense: { zh: '悬疑惊悚', en: 'Suspense' },
  speculative: { zh: '科幻与未来', en: 'Speculative' },
  realistic: { zh: '现实与行业', en: 'Realistic' },
  youth: { zh: '青春与轻娱乐', en: 'Youth & Light Fiction' },
  experimental: { zh: '类型融合', en: 'Hybrid' }
}

export const NOVEL_TEMPLATE_SEEDS: readonly NovelTemplateSeed[] =
  NOVEL_GENRES.map((genre) => ({
    name: genre.templateName,
    genre: genre.value,
    defaultStyleGuide: genre.styleGuide,
    defaultAiPrompt: genre.aiPrompt,
    defaultTemperature: genre.temperature
  }))

export function getNovelGenreMeta(genre: string | null | undefined) {
  return (
    NOVEL_GENRES.find((item) => item.value === genre) ??
    NOVEL_GENRES[NOVEL_GENRES.length - 1]!
  )
}

export function getNovelGenreColor(genre: string | null | undefined) {
  return getNovelGenreMeta(genre).color
}

export function getNovelGenreLabelKey(genre: string | null | undefined) {
  return getNovelGenreMeta(genre).labelKey
}
