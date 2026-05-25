import { z } from 'zod'
import { readDbConfig, writeDbConfig, type DbConfig } from '../../database/db-config'
import { initOrm, getOrm, testConnection, resetOrm } from '../../database'
import { syncDatabaseSchema } from '../../database/schema-sync'
import { hashPassword, signToken } from '../../utils/auth'
import { UserSchema, SiteConfigSchema, NovelTemplateSchema, PromptTemplateSchema } from '../../database/entities'

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
    throw createError({ statusCode: 400, message: 'System already initialized' })
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
  em.create(SiteConfigSchema, { key: 'db_instance_id', value: Date.now().toString(36) })

  // Seed novel templates
  const novelTemplates = [
    { name: '东方玄幻', genre: 'fantasy', defaultStyleGuide: '文风大气磅礴，注重修炼体系和功法描写，对话简洁有力，战斗场面要有画面感。多用短句营造紧张氛围，长句铺陈宏大场景。', defaultAiPrompt: '你是一位擅长东方玄幻小说的作家，熟悉修仙体系、宗门设定和天地法则。写作时注重力量等级的层次感和角色成长的爽感。', defaultTemperature: '0.8' },
    { name: '都市言情', genre: 'romance', defaultStyleGuide: '文风细腻温柔，注重人物心理描写和情感变化。对话自然生活化，善用细节烘托氛围。节奏张弛有度，甜虐交织。', defaultAiPrompt: '你是一位擅长都市言情的作家，善于刻画复杂的人物关系和细腻的情感变化。注重生活细节的真实感，让读者产生代入感。', defaultTemperature: '0.7' },
    { name: '悬疑推理', genre: 'mystery', defaultStyleGuide: '文风冷峻克制，善用伏笔和误导。叙述客观精准，对话暗藏玄机。节奏紧凑，每章结尾留悬念。线索铺设要合理，逻辑严密。', defaultAiPrompt: '你是一位擅长悬疑推理的作家，精通诡计设计和逻辑推演。写作时注意公平性原则，所有线索都要提前埋设，结局要出人意料又在情理之中。', defaultTemperature: '0.6' },
    { name: '科幻未来', genre: 'scifi', defaultStyleGuide: '文风硬朗理性，科技描写要有质感但不堆砌术语。世界观宏大但落脚点在人物命运。善用对比展现科技与人性的张力。', defaultAiPrompt: '你是一位擅长科幻小说的作家，熟悉前沿科技概念和未来社会推演。写作时在科学合理性和故事性之间取得平衡，探讨科技对人类的深层影响。', defaultTemperature: '0.7' },
    { name: '武侠江湖', genre: 'wuxia', defaultStyleGuide: '文风古朴典雅，善用四字短语和古诗词意境。武打描写要有招式感和画面感，江湖恩怨要有侠义精神。对话要有古风韵味但不晦涩。', defaultAiPrompt: '你是一位擅长武侠小说的作家，深谙江湖规矩和武学体系。写作时注重侠义精神的传达，人物要有鲜明的江湖气质，情节要有快意恩仇的爽感。', defaultTemperature: '0.75' },
    { name: '历史架空', genre: 'historical', defaultStyleGuide: '文风沉稳厚重，注重历史细节的考据感。人物对话符合时代特征，政治博弈要有层次。善用史实与虚构的交织，营造真实感。', defaultAiPrompt: '你是一位擅长历史小说的作家，熟悉中国各朝代的政治制度、社会风貌和文化特征。写作时在历史框架内合理虚构，人物行为要符合时代逻辑。', defaultTemperature: '0.65' },
  ]
  for (const tpl of novelTemplates) {
    em.create(NovelTemplateSchema, tpl)
  }

  // Seed prompt templates
  const promptTemplates: Array<{ name: string; content: string; category: 'generation' | 'rewrite' | 'expand' | 'character_generation' | 'custom'; isSystem: boolean }> = [
    { name: '标准章节生成', content: '请根据大纲和前文内容，续写下一章。保持人物性格一致，情节自然推进，注意伏笔的呼应。字数控制在2000-3000字。', category: 'generation', isSystem: true },
    { name: '高潮章节', content: '这是一个关键的高潮章节，请加强冲突和紧张感。节奏要快，对话要有力，情感要饱满。适当使用短句和段落切换来营造紧迫感。', category: 'generation', isSystem: true },
    { name: '过渡章节', content: '这是一个过渡章节，用于连接两个主要情节。节奏可以放缓，适当加入日常描写和角色互动，为下一个高潮做铺垫。注意埋设伏笔。', category: 'generation', isSystem: true },
    { name: '开篇引入', content: '这是小说的开篇章节，需要快速建立世界观、引入主角、制造悬念。开头要有吸引力，让读者想继续读下去。避免大段背景介绍，用行动和对话展现世界。', category: 'generation', isSystem: true },
    { name: '文笔润色', content: '请对选中的文本进行润色改写：提升文学性，丰富修辞手法，优化句式结构，但保持原意不变。避免过度华丽，追求自然流畅。', category: 'rewrite', isSystem: true },
    { name: '精简压缩', content: '请精简选中的文本：去除冗余描写，压缩重复信息，让表达更加简洁有力。保留核心信息和关键细节。', category: 'rewrite', isSystem: true },
    { name: '场景扩写', content: '请扩写选中的内容：增加环境描写、人物动作细节、感官体验（视觉、听觉、触觉等），让场景更加生动立体。', category: 'expand', isSystem: true },
    { name: '对话扩写', content: '请扩写选中的对话：增加人物的语气词、动作描写、心理活动，让对话更加生动自然，体现人物性格差异。', category: 'expand', isSystem: true },
    { name: '角色档案生成', content: '请根据小说内容，为这个角色生成详细档案：包括外貌特征、性格特点、背景故事、行为习惯、说话方式、与其他角色的关系。', category: 'character_generation', isSystem: true },
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
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/'
  })

  return { success: true }
})
