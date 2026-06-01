import { z } from 'zod'
import {
  readDbConfig,
  writeDbConfig,
  type DbConfig
} from '../../database/db-config'
import { initOrm, getOrm, testConnection, resetOrm } from '../../database'
import { syncDatabaseSchema } from '../../database/schema-sync'
import { hashPassword, signToken } from '../../utils/auth'
import {
  UserSchema,
  SiteConfigSchema,
  NovelTemplateSchema,
  PromptTemplateSchema
} from '../../database/entities'
import {
  NOVEL_TEMPLATE_SEEDS,
  NOVEL_TEMPLATE_SEED_VERSION
} from '~~/shared/novel-catalog'

const setupSchema = z.object({
  database: z.object({
    type: z.enum(['sqlite', 'mysql']),
    sqlite: z
      .object({
        path: z.string().min(1)
      })
      .optional(),
    mysql: z
      .object({
        host: z.string().min(1),
        port: z.number().int().min(1).max(65535),
        user: z.string().min(1),
        password: z.string(),
        database: z.string().min(1)
      })
      .optional()
  }),
  admin: z.object({
    username: z.string().min(3).max(50),
    password: z.string().min(1)
  }),
  site: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional()
  })
})

export default defineEventHandler(async (event) => {
  const existingConfig = readDbConfig()
  if (existingConfig) {
    throw createError({
      statusCode: 400,
      message: 'System already initialized'
    })
  }

  const body = await readBody(event)
  const data = setupSchema.parse(body)

  const dbConfig: DbConfig = {
    type: data.database.type,
    sqlite: data.database.sqlite,
    mysql: data.database.mysql
  }

  if (dbConfig.type === 'sqlite' && !dbConfig.sqlite) {
    dbConfig.sqlite = { path: './data/novel.db' }
  }

  const connTest = await testConnection(dbConfig)
  if (!connTest.success) {
    throw createError({
      statusCode: 400,
      message: `Database connection failed: ${connTest.error}`
    })
  }

  resetOrm()
  const orm = await initOrm(dbConfig)
  await syncDatabaseSchema(orm, 'setup')

  writeDbConfig(dbConfig)

  const em = getOrm().em.fork()

  const passwordHash = hashPassword(data.admin.password)
  const adminUser = em.create(UserSchema, {
    username: data.admin.username,
    passwordHash,
    role: 'admin'
  })

  em.create(SiteConfigSchema, { key: 'site_name', value: data.site.name })
  em.create(SiteConfigSchema, {
    key: 'site_description',
    value: data.site.description || ''
  })
  em.create(SiteConfigSchema, { key: 'allow_registration', value: 'false' })
  em.create(SiteConfigSchema, { key: 'initialized', value: 'true' })
  em.create(SiteConfigSchema, {
    key: 'db_instance_id',
    value: Date.now().toString(36)
  })

  // Seed novel templates
  const novelTemplates = [
    {
      name: '东方玄幻',
      genre: 'fantasy',
      defaultStyleGuide:
        '文风大气磅礴，注重修炼体系和功法描写，对话简洁有力，战斗场面要有画面感。多用短句营造紧张氛围，长句铺陈宏大场景。',
      defaultAiPrompt:
        '你是一位擅长东方玄幻小说的作家，熟悉修仙体系、宗门设定和天地法则。写作时注重力量等级的层次感和角色成长的爽感。',
      defaultTemperature: '0.8'
    },
    {
      name: '都市言情',
      genre: 'romance',
      defaultStyleGuide:
        '文风细腻温柔，注重人物心理描写和情感变化。对话自然生活化，善用细节烘托氛围。节奏张弛有度，甜虐交织。',
      defaultAiPrompt:
        '你是一位擅长都市言情的作家，善于刻画复杂的人物关系和细腻的情感变化。注重生活细节的真实感，让读者产生代入感。',
      defaultTemperature: '0.7'
    },
    {
      name: '悬疑推理',
      genre: 'mystery',
      defaultStyleGuide:
        '文风冷峻克制，善用伏笔和误导。叙述客观精准，对话暗藏玄机。节奏紧凑，每章结尾留悬念。线索铺设要合理，逻辑严密。',
      defaultAiPrompt:
        '你是一位擅长悬疑推理的作家，精通诡计设计和逻辑推演。写作时注意公平性原则，所有线索都要提前埋设，结局要出人意料又在情理之中。',
      defaultTemperature: '0.6'
    },
    {
      name: '科幻未来',
      genre: 'scifi',
      defaultStyleGuide:
        '文风硬朗理性，科技描写要有质感但不堆砌术语。世界观宏大但落脚点在人物命运。善用对比展现科技与人性的张力。',
      defaultAiPrompt:
        '你是一位擅长科幻小说的作家，熟悉前沿科技概念和未来社会推演。写作时在科学合理性和故事性之间取得平衡，探讨科技对人类的深层影响。',
      defaultTemperature: '0.7'
    },
    {
      name: '武侠江湖',
      genre: 'wuxia',
      defaultStyleGuide:
        '文风古朴典雅，善用四字短语和古诗词意境。武打描写要有招式感和画面感，江湖恩怨要有侠义精神。对话要有古风韵味但不晦涩。',
      defaultAiPrompt:
        '你是一位擅长武侠小说的作家，深谙江湖规矩和武学体系。写作时注重侠义精神的传达，人物要有鲜明的江湖气质，情节要有快意恩仇的爽感。',
      defaultTemperature: '0.75'
    },
    {
      name: '历史架空',
      genre: 'historical',
      defaultStyleGuide:
        '文风沉稳厚重，注重历史细节的考据感。人物对话符合时代特征，政治博弈要有层次。善用史实与虚构的交织，营造真实感。',
      defaultAiPrompt:
        '你是一位擅长历史小说的作家，熟悉中国各朝代的政治制度、社会风貌和文化特征。写作时在历史框架内合理虚构，人物行为要符合时代逻辑。',
      defaultTemperature: '0.65'
    },
    {
      name: '恐怖惊悚',
      genre: 'horror',
      defaultStyleGuide:
        '文风阴冷压抑，善用环境描写营造恐怖氛围。节奏由慢到快，恐惧层层递进。善用暗示和留白，让读者自行脑补最恐怖的画面。少用直白的血腥描写，多用心理恐惧。',
      defaultAiPrompt:
        '你是一位擅长恐怖惊悚小说的作家，精通氛围营造和心理恐惧的描写。写作时注重悬念的层层推进，善用日常场景中的违和感制造不安，结局要有余韵。',
      defaultTemperature: '0.7'
    },
    {
      name: '末日废土',
      genre: 'apocalypse',
      defaultStyleGuide:
        '文风苍凉粗粝，环境描写突出荒芜和危险感。人物对话简短实用，生存压力贯穿始终。善用资源匮乏和道德困境推动情节，展现人性在极端环境下的选择。',
      defaultAiPrompt:
        '你是一位擅长末日废土题材的作家，熟悉生存类小说的节奏把控。写作时注重世界观的合理性，资源体系要自洽，人物成长要伴随艰难抉择。',
      defaultTemperature: '0.75'
    },
    {
      name: '游戏竞技',
      genre: 'gaming',
      defaultStyleGuide:
        '文风热血激昂，战斗描写节奏明快。善用游戏术语但不过度堆砌，操作描写要有画面感和紧迫感。团队配合和个人突破交替展现，比赛场面要有解说感。',
      defaultAiPrompt:
        '你是一位擅长游戏竞技小说的作家，熟悉电竞文化和游戏机制设计。写作时注重比赛的紧张感和策略博弈，角色成长要有训练和突破的过程，团队关系要真实。',
      defaultTemperature: '0.75'
    },
    {
      name: '仙侠修真',
      genre: 'xianxia',
      defaultStyleGuide:
        '文风空灵飘逸，注重天地大道和修行感悟的描写。场景要有仙气和意境美，战斗融合法术和天地异象。人物要有求道之心，情节兼顾修行与红尘历练。',
      defaultAiPrompt:
        '你是一位擅长仙侠修真小说的作家，熟悉道家哲学和修仙体系。写作时注重境界突破的顿悟感，天劫和历练要有仪式感，人物要在长生与情感间有所取舍。',
      defaultTemperature: '0.8'
    },
    {
      name: '都市异能',
      genre: 'urban_fantasy',
      defaultStyleGuide:
        '文风现代利落，异能描写融入都市日常。节奏紧凑，动作场面干净利落。善用现代都市元素与超自然力量的反差制造趣味，隐藏世界的设定要有层次。',
      defaultAiPrompt:
        '你是一位擅长都市异能小说的作家，善于将超自然元素融入现代都市背景。写作时注重异能体系的独特性，日常与非日常的切换要自然，角色要有双重身份的张力。',
      defaultTemperature: '0.75'
    },
    {
      name: '军事战争',
      genre: 'military',
      defaultStyleGuide:
        '文风刚硬严谨，战术描写专业但不枯燥。注重战场环境和士兵心理的刻画，对话简洁有军人气质。大场面和个人视角交替，展现战争的残酷与人性光辉。',
      defaultAiPrompt:
        '你是一位擅长军事战争小说的作家，熟悉军事战术和武器装备。写作时注重战场的真实感和紧迫感，人物要有军人的纪律性和战友情，战略层面和个人命运要有呼应。',
      defaultTemperature: '0.65'
    },
    {
      name: '校园青春',
      genre: 'campus',
      defaultStyleGuide:
        '文风清新明快，充满青春气息。对话活泼自然，善用校园场景和学生日常。情感描写含蓄纯真，成长主题贯穿始终。节奏轻松中带有感动，结局要有青春的遗憾美。',
      defaultAiPrompt:
        '你是一位擅长校园青春小说的作家，善于捕捉少年时代的情感和成长。写作时注重校园生活的真实感，友情和爱情的萌动要自然，角色要有各自的梦想和困惑。',
      defaultTemperature: '0.7'
    },
    {
      name: '商战职场',
      genre: 'business',
      defaultStyleGuide:
        '文风干练犀利，商业博弈描写要有层次和策略感。对话暗藏锋芒，人物关系复杂多变。善用商业案例和行业知识增加真实感，权力斗争和个人成长并行。',
      defaultAiPrompt:
        '你是一位擅长商战职场小说的作家，熟悉企业运营和商业逻辑。写作时注重商业策略的合理性，人物要有鲜明的职业特征，权谋和情感要有平衡。',
      defaultTemperature: '0.65'
    },
    {
      name: '无限流',
      genre: 'infinite',
      defaultStyleGuide:
        '文风紧张刺激，副本规则描写清晰有创意。生死压力贯穿始终，角色能力成长要有体系。善用规则漏洞和智斗展现主角智慧，团队合作与背叛交织。',
      defaultAiPrompt:
        '你是一位擅长无限流小说的作家，精通副本设计和规则制定。写作时注重每个副本的独特性和规则的自洽性，角色要在极端环境下展现不同面，积分和能力体系要合理。',
      defaultTemperature: '0.8'
    },
    {
      name: '系统流',
      genre: 'system',
      defaultStyleGuide:
        '文风轻松爽快，系统面板描写简洁明了。升级节奏明快，任务设计有趣。善用系统奖励制造爽点，主角成长要有阶段性突破。吐槽和幽默元素适当穿插。',
      defaultAiPrompt:
        '你是一位擅长系统流小说的作家，熟悉游戏化叙事和数值设计。写作时注重系统的独特性和趣味性，任务链要有逻辑，主角与系统的互动要有个性，升级爽感要持续。',
      defaultTemperature: '0.8'
    },
    {
      name: '穿越重生',
      genre: 'rebirth',
      defaultStyleGuide:
        '文风从容自信，善用前世记忆制造信息差优势。布局要有远见，人物关系的改变要合理。前世遗憾的弥补要有情感厚度，蝴蝶效应的展现要有层次。',
      defaultAiPrompt:
        '你是一位擅长穿越重生小说的作家，善于利用信息差和时间线设计情节。写作时注重重生优势的合理运用，不能过于开挂，人物关系的重新经营要有新意，命运改变要有代价。',
      defaultTemperature: '0.7'
    },
    {
      name: '克苏鲁神话',
      genre: 'cosmic_horror',
      defaultStyleGuide:
        '文风晦暗深邃，善用不可名状的恐惧和认知崩塌。环境描写充满压迫感和异质感，人物面对未知时的渺小和疯狂要有层次。善用暗示和碎片化信息，避免直接描写不可描述之物。',
      defaultAiPrompt:
        '你是一位擅长克苏鲁风格小说的作家，熟悉宇宙恐怖和认知恐惧的写法。写作时注重未知的压迫感，人类理性在面对超越存在时的崩溃要循序渐进，调查和发现的过程要有仪式感。',
      defaultTemperature: '0.7'
    },
    {
      name: '轻小说',
      genre: 'light_novel',
      defaultStyleGuide:
        '文风轻快活泼，对话占比高且富有个性。善用吐槽和日常互动展现角色魅力，场景描写简洁有画面感。节奏明快不拖沓，每章都有看点。适当使用轻小说特有的表现手法。',
      defaultAiPrompt:
        '你是一位擅长轻小说风格的作家，熟悉日系轻小说的叙事节奏和角色塑造。写作时注重角色的鲜明个性和互动趣味，日常与冒险的切换要自然，要有让读者会心一笑的桥段。',
      defaultTemperature: '0.8'
    },
    {
      name: '赛博朋克',
      genre: 'cyberpunk',
      defaultStyleGuide:
        '文风冷硬颓废，充满霓虹灯和雨夜的意象。科技描写融入日常，贫富差距和企业压迫是底色。对话简短有街头感，动作场面融合义体改造和黑客入侵。',
      defaultAiPrompt:
        '你是一位擅长赛博朋克小说的作家，熟悉高科技低生活的美学和社会批判。写作时注重科技对人性的异化，底层挣扎和反抗要有力量感，虚拟与现实的边界要模糊。',
      defaultTemperature: '0.75'
    },
    {
      name: '谍战特工',
      genre: 'spy',
      defaultStyleGuide:
        '文风冷静克制，信息量大但不杂乱。人物多面且难辨忠奸，对话暗藏多层含义。善用身份切换和信任危机推动情节，紧张感要持续但不疲劳。',
      defaultAiPrompt:
        '你是一位擅长谍战特工小说的作家，熟悉情报工作和心理博弈。写作时注重身份伪装的细节和暴露的危机感，多方势力的博弈要清晰，人物在忠诚与生存间的挣扎要真实。',
      defaultTemperature: '0.65'
    },
    {
      name: '田园生活',
      genre: 'pastoral',
      defaultStyleGuide:
        '文风恬淡温馨，善用自然景物和季节变化。生活细节丰富有烟火气，人物关系温暖治愈。节奏舒缓，注重日常的美好和小确幸。美食和手工描写要有质感。',
      defaultAiPrompt:
        '你是一位擅长田园生活小说的作家，善于描绘乡村生活的美好和人情味。写作时注重生活细节的真实感和治愈感，四季变化和自然之美要有诗意，邻里关系要温暖有趣。',
      defaultTemperature: '0.7'
    },
    {
      name: '西方奇幻',
      genre: 'western_fantasy',
      defaultStyleGuide:
        '文风史诗恢弘，世界观设定完整有深度。种族和魔法体系要有独特性，战争和政治描写要有史诗感。人物命运与世界命运交织，善恶界限模糊。',
      defaultAiPrompt:
        '你是一位擅长西方奇幻小说的作家，熟悉中世纪背景和魔法体系设计。写作时注重世界观的完整性和文化深度，种族间的冲突要有历史根源，英雄之旅要有成长和牺牲。',
      defaultTemperature: '0.8'
    },
    {
      name: '喜剧幽默',
      genre: 'comedy',
      defaultStyleGuide:
        '文风诙谐有趣，善用反转和误会制造笑点。对话机智幽默，人物性格夸张但可爱。节奏轻快，包袱密集但不尬。在搞笑中融入温情，让读者笑中带泪。',
      defaultAiPrompt:
        '你是一位擅长喜剧小说的作家，精通各种幽默技巧和喜剧节奏。写作时注重笑点的自然和密度，人物的窘境要有共鸣感，反转要出人意料，在欢笑中传递温暖的主题。',
      defaultTemperature: '0.85'
    }
  ]
  for (const tpl of novelTemplates) {
    em.create(NovelTemplateSchema, tpl)
  }
  const existingTemplateNames = new Set(novelTemplates.map((tpl) => tpl.name))
  for (const tpl of NOVEL_TEMPLATE_SEEDS) {
    if (existingTemplateNames.has(tpl.name)) continue
    em.create(NovelTemplateSchema, tpl)
  }
  em.create(SiteConfigSchema, {
    key: 'novel_template_seed_version',
    value: NOVEL_TEMPLATE_SEED_VERSION
  })

  // Seed prompt templates
  const promptTemplates: Array<{
    name: string
    content: string
    category:
      | 'generation'
      | 'rewrite'
      | 'expand'
      | 'character_generation'
      | 'custom'
    isSystem: boolean
  }> = [
    {
      name: '标准章节生成',
      content:
        '请根据大纲和前文内容，续写下一章。保持人物性格一致，情节自然推进，注意伏笔的呼应。字数控制在2000-3000字。',
      category: 'generation',
      isSystem: true
    },
    {
      name: '高潮章节',
      content:
        '这是一个关键的高潮章节，请加强冲突和紧张感。节奏要快，对话要有力，情感要饱满。适当使用短句和段落切换来营造紧迫感。',
      category: 'generation',
      isSystem: true
    },
    {
      name: '过渡章节',
      content:
        '这是一个过渡章节，用于连接两个主要情节。节奏可以放缓，适当加入日常描写和角色互动，为下一个高潮做铺垫。注意埋设伏笔。',
      category: 'generation',
      isSystem: true
    },
    {
      name: '开篇引入',
      content:
        '这是小说的开篇章节，需要快速建立世界观、引入主角、制造悬念。开头要有吸引力，让读者想继续读下去。避免大段背景介绍，用行动和对话展现世界。',
      category: 'generation',
      isSystem: true
    },
    {
      name: '文笔润色',
      content:
        '请对选中的文本进行润色改写：提升文学性，丰富修辞手法，优化句式结构，但保持原意不变。避免过度华丽，追求自然流畅。',
      category: 'rewrite',
      isSystem: true
    },
    {
      name: '精简压缩',
      content:
        '请精简选中的文本：去除冗余描写，压缩重复信息，让表达更加简洁有力。保留核心信息和关键细节。',
      category: 'rewrite',
      isSystem: true
    },
    {
      name: '场景扩写',
      content:
        '请扩写选中的内容：增加环境描写、人物动作细节、感官体验（视觉、听觉、触觉等），让场景更加生动立体。',
      category: 'expand',
      isSystem: true
    },
    {
      name: '对话扩写',
      content:
        '请扩写选中的对话：增加人物的语气词、动作描写、心理活动，让对话更加生动自然，体现人物性格差异。',
      category: 'expand',
      isSystem: true
    },
    {
      name: '角色档案生成',
      content:
        '请根据小说内容，为这个角色生成详细档案：包括外貌特征、性格特点、背景故事、行为习惯、说话方式、与其他角色的关系。',
      category: 'character_generation',
      isSystem: true
    }
  ]
  for (const tpl of promptTemplates) {
    em.create(PromptTemplateSchema, tpl)
  }

  await em.flush()

  const token = signToken({
    userId: adminUser.id,
    username: data.admin.username,
    role: 'admin'
  })

  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    secure: getRequestURL(event).protocol === 'https:',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/'
  })

  return { success: true }
})
