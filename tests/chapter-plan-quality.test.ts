import { describe, expect, it } from 'vitest'
import {
  buildChapterPlanFieldFallback,
  hasInvalidGeneratedPlanIssue,
  mergeChapterPlanPartials,
  parseChapterPlanDraft,
  parseChapterPlanFieldValue,
  parseChapterPlanPartialDraft,
  validateChapterPlanDraft,
  type ChapterPlanDraftField,
  type ChapterPlanDraft,
  type ChapterPlanReferenceContext
} from '../server/utils/chapter-plan-quality'

function validPlan(
  overrides: Partial<ChapterPlanDraft> = {}
): ChapterPlanDraft {
  return {
    goal: '逼主角在救人和隐藏身份之间做选择，推进他与皇帝的信任裂缝。',
    conflict: '反派安排刺杀，主角必须暴露部分能力才能救下关键证人。',
    turningPoint: '证人临死前说出幕后黑手并非表面上的二皇子。',
    beats: ['主角发现暗号', '皇帝试探主角', '刺杀发生', '证人留下反转线索'],
    mustInclude: ['主角不能直接说出真实身份'],
    avoid: ['不要提前揭露最终幕后黑手'],
    characters: [1, 2],
    characterStateDeltas: ['主角对皇帝的戒备加深'],
    plotThreadActions: [10],
    foreshadowingActions: [20],
    interestHooks: ['证人指出真正黑手另有其人'],
    continuityRisks: [],
    pacing: '紧张推进，章末留钩子',
    protocol: '第三人称有限视角',
    ...overrides
  }
}

const context: ChapterPlanReferenceContext = {
  chapterNumber: 3,
  characterIds: new Set([1, 2]),
  plotPointIds: new Set([10]),
  foreshadowingIds: new Set([20])
}

describe('chapter-plan-quality', () => {
  it('parses structured plan JSON from model output', () => {
    const plan = parseChapterPlanDraft(`\n\`\`\`json
{"goal":"推进调查","conflict":"身份暴露风险","turningPoint":"证人改口","beats":["发现暗号"],"mustInclude":["玉佩"],"avoid":["不要揭露真凶"],"characters":[1],"characterStateDeltas":["主角更谨慎"],"plotThreadActions":[10],"foreshadowingActions":[20],"interestHooks":["证人提到另一个名字"],"continuityRisks":[],"pacing":"紧张","protocol":"称谓谨慎"}
\`\`\``)

    expect(plan).toMatchObject({
      goal: '推进调查',
      conflict: '身份暴露风险',
      turningPoint: '证人改口',
      beats: ['发现暗号'],
      characters: [1],
      plotThreadActions: [10],
      foreshadowingActions: [20]
    })
  })

  it('keeps legacy chapter plan fields usable while leaving quality gaps visible', () => {
    const plan = parseChapterPlanDraft(
      '{"goal":"救出证人","mustInclude":"暗号、玉佩","avoid":"不要暴露身份","pacing":"快","protocol":"古代称谓"}'
    )

    expect(plan).toMatchObject({
      goal: '救出证人',
      mustInclude: ['暗号、玉佩'],
      avoid: ['不要暴露身份'],
      conflict: '',
      turningPoint: '',
      interestHooks: []
    })
  })

  it('parses plan objects wrapped by model output', () => {
    const plan = parseChapterPlanDraft(
      '{"plan":{"goal":"稳住冷宫局面","conflict":"女主既要自保又要避开皇帝耳目","turningPoint":"贴身宫女发现药渣被人调包","beats":["女主醒来确认处境","宫女带来异常汤药","女主试探下人反应"],"interestHooks":["药渣来源指向御前人"],"characters":[],"plotThreadActions":[],"foreshadowingActions":[],"mustInclude":[],"avoid":[],"characterStateDeltas":[],"continuityRisks":[],"pacing":"紧张克制","protocol":"宫廷称谓谨慎"}}'
    )

    expect(plan).toMatchObject({
      goal: '稳住冷宫局面',
      conflict: '女主既要自保又要避开皇帝耳目',
      turningPoint: '贴身宫女发现药渣被人调包',
      beats: ['女主醒来确认处境', '宫女带来异常汤药', '女主试探下人反应'],
      interestHooks: ['药渣来源指向御前人']
    })
  })

  it('parses Chinese wrapped plan objects from model output', () => {
    const plan = parseChapterPlanDraft(
      '{"剧情计划":{"goal":"稳住冷宫局面","conflict":"女主既要自保又要避开皇帝耳目","turningPoint":"贴身宫女发现药渣被人调包","beats":["女主醒来确认处境","宫女带来异常汤药","女主试探下人反应"],"interestHooks":["药渣来源指向御前人"]}}'
    )

    expect(plan).toMatchObject({
      goal: '稳住冷宫局面',
      conflict: '女主既要自保又要避开皇帝耳目',
      turningPoint: '贴身宫女发现药渣被人调包',
      beats: ['女主醒来确认处境', '宫女带来异常汤药', '女主试探下人反应'],
      interestHooks: ['药渣来源指向御前人']
    })
  })

  it('parses common Chinese field aliases from model output', () => {
    const plan = parseChapterPlanDraft(
      '{"目标":"稳住冷宫局面","核心冲突":"女主既要自保又要避开皇帝耳目","关键转折":"贴身宫女发现药渣被人调包","剧情节拍":["女主醒来确认处境","宫女带来异常汤药"],"兴趣钩子":["药渣来源指向御前人"],"必须出现":["冷宫汤药"],"避免":["不要提前揭露幕后黑手"],"角色":[1],"情绪与节奏":"紧张克制","称谓设定":"宫廷称谓谨慎"}'
    )

    expect(plan).toMatchObject({
      goal: '稳住冷宫局面',
      conflict: '女主既要自保又要避开皇帝耳目',
      turningPoint: '贴身宫女发现药渣被人调包',
      beats: ['女主醒来确认处境', '宫女带来异常汤药'],
      interestHooks: ['药渣来源指向御前人'],
      mustInclude: ['冷宫汤药'],
      avoid: ['不要提前揭露幕后黑手'],
      characters: [1],
      pacing: '紧张克制',
      protocol: '宫廷称谓谨慎'
    })
  })

  it('rejects model output without any usable plan fields', () => {
    expect(() => parseChapterPlanDraft('好的，我来帮你生成。')).toThrow(
      'AI 未返回可用的剧情计划：未找到 JSON 对象'
    )
    expect(() => parseChapterPlanDraft('{"plan":{}}')).toThrow(
      'AI 未返回可用的剧情计划：JSON 缺少可用剧情字段'
    )
  })

  it('parses only allowed fields from a partial plan response', () => {
    const allowedFields: ChapterPlanDraftField[] = [
      'goal',
      'conflict',
      'turningPoint',
      'beats',
      'interestHooks'
    ]
    const partial = parseChapterPlanPartialDraft(
      '{"goal":"稳住冷宫局面","conflict":"隐藏异常与自保冲突","turningPoint":"药渣被调包","beats":["醒来确认身份","试探宫女"],"interestHooks":["药渣指向御前人"],"characters":[999],"protocol":"不要采纳"}',
      allowedFields
    )

    expect(partial).toEqual({
      goal: '稳住冷宫局面',
      conflict: '隐藏异常与自保冲突',
      turningPoint: '药渣被调包',
      beats: ['醒来确认身份', '试探宫女'],
      interestHooks: ['药渣指向御前人']
    })
  })

  it('parses a core partial wrapped by the model section title', () => {
    const partial = parseChapterPlanPartialDraft(
      '{"剧情骨架":{"goal":"稳住冷宫局面","conflict":"隐藏异常与自保冲突","turningPoint":"药渣被调包","beats":["醒来确认身份","试探宫女","发现汤药异常"],"interestHooks":["药渣来源指向御前人"]}}',
      ['goal', 'conflict', 'turningPoint', 'beats', 'interestHooks']
    )

    expect(partial).toEqual({
      goal: '稳住冷宫局面',
      conflict: '隐藏异常与自保冲突',
      turningPoint: '药渣被调包',
      beats: ['醒来确认身份', '试探宫女', '发现汤药异常'],
      interestHooks: ['药渣来源指向御前人']
    })
  })

  it('parses a core partial wrapped by nested plan and section titles', () => {
    const partial = parseChapterPlanPartialDraft(
      '{"章节计划":{"剧情骨架":{"goal":"稳住冷宫局面","conflict":"隐藏异常与自保冲突","turningPoint":"药渣被调包","beats":["醒来确认身份","试探宫女","发现汤药异常"],"interestHooks":["药渣来源指向御前人"]}}}',
      ['goal', 'conflict', 'turningPoint', 'beats', 'interestHooks']
    )

    expect(partial).toEqual({
      goal: '稳住冷宫局面',
      conflict: '隐藏异常与自保冲突',
      turningPoint: '药渣被调包',
      beats: ['醒来确认身份', '试探宫女', '发现汤药异常'],
      interestHooks: ['药渣来源指向御前人']
    })
  })

  it('parses common Chinese aliases from a core partial response', () => {
    const partial = parseChapterPlanPartialDraft(
      '{"本章核心目标":"稳住冷宫局面","主要冲突":"隐藏异常与自保冲突","关键转折点":"药渣被调包","情节节拍":["醒来确认身份","试探宫女","发现汤药异常"],"悬念钩子":["药渣来源指向御前人"]}',
      ['goal', 'conflict', 'turningPoint', 'beats', 'interestHooks']
    )

    expect(partial).toEqual({
      goal: '稳住冷宫局面',
      conflict: '隐藏异常与自保冲突',
      turningPoint: '药渣被调包',
      beats: ['醒来确认身份', '试探宫女', '发现汤药异常'],
      interestHooks: ['药渣来源指向御前人']
    })
  })

  it('finds usable core fields inside unknown nested wrapper objects', () => {
    const partial = parseChapterPlanPartialDraft(
      '{"output":{"核心剧情":{"本章目标":"稳住冷宫局面","核心冲突":"隐藏异常与自保冲突","关键转折":"药渣被调包","剧情节拍":["醒来确认身份","试探宫女","发现汤药异常"],"兴趣钩子":["药渣来源指向御前人"]}}}',
      ['goal', 'conflict', 'turningPoint', 'beats', 'interestHooks']
    )

    expect(partial).toEqual({
      goal: '稳住冷宫局面',
      conflict: '隐藏异常与自保冲突',
      turningPoint: '药渣被调包',
      beats: ['醒来确认身份', '试探宫女', '发现汤药异常'],
      interestHooks: ['药渣来源指向御前人']
    })
  })

  it('salvages a core partial from labeled non-json model output', () => {
    const partial = parseChapterPlanPartialDraft(
      `剧情骨架：
本章目标：稳住冷宫局面
核心冲突：隐藏异常与自保冲突
关键转折：药渣被调包
剧情节拍：
1. 醒来确认身份
2. 试探宫女
3. 发现汤药异常
兴趣钩子：药渣来源指向御前人`,
      ['goal', 'conflict', 'turningPoint', 'beats', 'interestHooks']
    )

    expect(partial).toEqual({
      goal: '稳住冷宫局面',
      conflict: '隐藏异常与自保冲突',
      turningPoint: '药渣被调包',
      beats: ['醒来确认身份', '试探宫女', '发现汤药异常'],
      interestHooks: ['药渣来源指向御前人']
    })
  })

  it('uses the later usable JSON object when model content starts with reasoning and an empty template', () => {
    const partial = parseChapterPlanPartialDraft(
      `首先，我需要修复章节计划。JSON形状必须严格匹配：{"goal":"","conflict":"","turningPoint":"","beats":[],"interestHooks":[]}。
经过分析，最终结果如下：
{"goal":"稳住冷宫局面","conflict":"隐藏异常与自保冲突","turningPoint":"药渣被调包","beats":["醒来确认身份","试探宫女","发现汤药异常"],"interestHooks":["药渣来源指向御前人"]}`,
      ['goal', 'conflict', 'turningPoint', 'beats', 'interestHooks']
    )

    expect(partial).toEqual({
      goal: '稳住冷宫局面',
      conflict: '隐藏异常与自保冲突',
      turningPoint: '药渣被调包',
      beats: ['醒来确认身份', '试探宫女', '发现汤药异常'],
      interestHooks: ['药渣来源指向御前人']
    })
  })

  it('salvages core values from reasoning text that says fields can be quoted values', () => {
    const partial = parseChapterPlanPartialDraft(
      `现在，为每个字段构思内容：
- goal：本章的目标应该是林薇的目标。所以，goal可以是“林薇在冷宫苏醒后，必须利用皇帝赵玄冥的恶魔血脉和残暴性格，在三日内找到一线生机，避免斩首。”
- conflict：冲突应该是林薇面临的困境。所以，conflict可以是“林薇被困冷宫，证据确凿，皇帝冷漠审视，皇后李婉容接管调查，她必须在绝境中对抗原书剧情和宫廷势力。”
- turningPoint：转折点应该是剧情的关键转折。所以，turningPoint可以是“皇帝赵玄冥在拂袖而去前，投来意味深长的一瞥，仿佛在衡量林薇的价值，这让她意识到自己可能还有利用价值。”
- beats：必须是字符串数组，至少3条，每条是可执行剧情动作。从大纲中提取关键事件：
  1. 林薇在冷宫苏醒，头痛中回忆起穿书记忆。
  2. 皇帝赵玄冥驾临，嘲讽林薇，提及皇后调查。
  3. 林薇以原主姿态狡辩，内心计算求生策略。
  4. 皇帝离开，林薇冷静下来，摊开掌心思考。
- interestHooks：interestHooks可以是“皇帝离开前意味深长的一瞥暗示林薇并非毫无利用价值，三日死局出现一丝裂缝。”`,
      ['goal', 'conflict', 'turningPoint', 'beats', 'interestHooks']
    )

    expect(partial).toEqual({
      goal: '林薇在冷宫苏醒后，必须利用皇帝赵玄冥的恶魔血脉和残暴性格，在三日内找到一线生机，避免斩首。',
      conflict:
        '林薇被困冷宫，证据确凿，皇帝冷漠审视，皇后李婉容接管调查，她必须在绝境中对抗原书剧情和宫廷势力。',
      turningPoint:
        '皇帝赵玄冥在拂袖而去前，投来意味深长的一瞥，仿佛在衡量林薇的价值，这让她意识到自己可能还有利用价值。',
      beats: [
        '林薇在冷宫苏醒，头痛中回忆起穿书记忆。',
        '皇帝赵玄冥驾临，嘲讽林薇，提及皇后调查。',
        '林薇以原主姿态狡辩，内心计算求生策略。',
        '皇帝离开，林薇冷静下来，摊开掌心思考。'
      ],
      interestHooks: [
        '皇帝离开前意味深长的一瞥暗示林薇并非毫无利用价值，三日死局出现一丝裂缝。'
      ]
    })
  })

  it('salvages core values from verbose reasoning output that repeats the json template first', () => {
    const partial = parseChapterPlanPartialDraft(
      `首先，用户要求我只返回严格的JSON对象，不要任何解释、思考过程或额外文字。第一个字符必须是{，最后一个字符必须是}。JSON形状必须严格匹配：{"goal":"","conflict":"","turningPoint":"","beats":[],"interestHooks":[]}。

现在，为每个字段构思内容：
- goal：本章的目标应该是林薇的目标。大纲中，林薇的目标是改变斩首命运，在三日内找到生机。所以，goal可以是“林薇在冷宫苏醒后，必须利用皇帝赵玄冥的恶魔血脉和残暴性格，在三日内找到一线生机，避免斩首。”
- conflict：冲突应该是林薇面临的困境。大纲中，冲突是林薇被囚禁冷宫，面临斩首，同时皇帝和皇后都对她不利。所以，conflict可以是“林薇被困冷宫，证据确凿，皇帝冷漠审视，皇后李婉容接管调查，她必须在绝境中对抗原书剧情和宫廷势力。”
- turningPoint：转折点应该是剧情的关键转折。大纲中，转折点可能是皇帝离开前意味深长的一瞥，或者林薇冷静下来意识到剧情被拨动。所以，turningPoint可以是“皇帝赵玄冥在拂袖而去前，投来意味深长的一瞥，仿佛在衡量林薇的价值，这让她意识到自己可能还有利用价值。”
- beats：必须是字符串数组，至少3条，每条是可执行剧情动作。从大纲中提取关键事件：
  1. 林薇在冷宫苏醒，头痛中回忆起穿书记忆。
  2. 皇帝赵玄冥驾临，嘲讽林薇，提及皇后调查。
  3. 林薇以原主姿态狡辩，内心计算求生策略。
  4. 皇帝离开，林薇冷静下来，摊开掌心思考。`,
      ['goal', 'conflict', 'turningPoint', 'beats', 'interestHooks']
    )

    expect(partial).toMatchObject({
      goal: '林薇在冷宫苏醒后，必须利用皇帝赵玄冥的恶魔血脉和残暴性格，在三日内找到一线生机，避免斩首。',
      conflict:
        '林薇被困冷宫，证据确凿，皇帝冷漠审视，皇后李婉容接管调查，她必须在绝境中对抗原书剧情和宫廷势力。',
      turningPoint:
        '皇帝赵玄冥在拂袖而去前，投来意味深长的一瞥，仿佛在衡量林薇的价值，这让她意识到自己可能还有利用价值。',
      beats: [
        '林薇在冷宫苏醒，头痛中回忆起穿书记忆。',
        '皇帝赵玄冥驾临，嘲讽林薇，提及皇后调查。',
        '林薇以原主姿态狡辩，内心计算求生策略。',
        '皇帝离开，林薇冷静下来，摊开掌心思考。'
      ]
    })
  })

  it('salvages core values from markdown numbered field analysis', () => {
    const partial = parseChapterPlanPartialDraft(
      `我需要提取关键元素来填充JSON字段：

1. **goal**：本章的目标。从大纲看，林薇的目标是改变斩首命运，撬动一丝生机。所以，goal应该是林薇在本章中试图实现的具体目标。

   - 具体内容：林薇在冷宫中苏醒后，目标是利用皇帝赵玄冥的恶魔血脉和残暴性格，在三日倒计时中找到生存机会。

2. **conflict**：本章的冲突。冲突是林薇面临的困境：被囚禁冷宫，三日后斩首，以及与皇帝的敌对关系。

   - 例如，“林薇面临三日后斩首的死亡威胁，同时被囚禁冷宫，孤立无援，必须对抗原书剧情的束缚、皇帝赵玄冥的残暴审视和皇后李婉容的阴谋。”

3. **turningPoint**：本章的转折点。从大纲看，转折点可能是皇帝离去前意味深长的一瞥。

   - 具体内容：皇帝离去前意味深长的一瞥，让林薇意识到自己并非毫无利用价值，三日死局出现裂缝。

4. **beats**：剧情节拍。

   1. 林薇在冷宫苏醒，意识到自己穿书成恶毒女配。
   2. 皇帝赵玄冥驾临冷宫，冷漠审视并嘲讽林薇。
   3. 林薇压下恐惧，以原主姿态狡辩，同时内心计算求生路径。

5. **interestHooks**：兴趣钩子。

   - 具体内容：皇帝离去前意味深长的一瞥暗示林薇仍有利用价值，三日斩首倒计时出现第一道裂缝。`,
      ['goal', 'conflict', 'turningPoint', 'beats', 'interestHooks']
    )

    expect(partial).toEqual({
      goal: '林薇在冷宫中苏醒后，目标是利用皇帝赵玄冥的恶魔血脉和残暴性格，在三日倒计时中找到生存机会。',
      conflict:
        '林薇面临三日后斩首的死亡威胁，同时被囚禁冷宫，孤立无援，必须对抗原书剧情的束缚、皇帝赵玄冥的残暴审视和皇后李婉容的阴谋。',
      turningPoint:
        '皇帝离去前意味深长的一瞥，让林薇意识到自己并非毫无利用价值，三日死局出现裂缝。',
      beats: [
        '林薇在冷宫苏醒，意识到自己穿书成恶毒女配。',
        '皇帝赵玄冥驾临冷宫，冷漠审视并嘲讽林薇。',
        '林薇压下恐惧，以原主姿态狡辩，同时内心计算求生路径。'
      ],
      interestHooks: [
        '皇帝离去前意味深长的一瞥暗示林薇仍有利用价值，三日斩首倒计时出现第一道裂缝。'
      ]
    })
  })

  it('parses one list field from model analysis without requiring json', () => {
    const value = parseChapterPlanFieldValue(
      `首先，用户要求我生成 mustInclude 输入框内容。

1. mustInclude：基于大纲，关键元素包括：
   - 林薇在冷宫苏醒并接收原主记忆。
   - 三日后斩首的倒计时压迫感。
   - 皇帝赵玄冥驾临冷宫并展现恶魔血脉特征。
   - 林薇以原主姿态狡辩，同时内心计算求生路径。

2. avoid：这里不应该被当前字段采纳。`,
      { field: 'mustInclude', kind: 'list' }
    )

    expect(value).toEqual([
      '林薇在冷宫苏醒并接收原主记忆。',
      '三日后斩首的倒计时压迫感。',
      '皇帝赵玄冥驾临冷宫并展现恶魔血脉特征。',
      '林薇以原主姿态狡辩，同时内心计算求生路径。'
    ])
  })

  it('extracts concrete category items from verbose list field analysis', () => {
    const value = parseChapterPlanFieldValue(
      `首先，用户要求我只生成【必须出现】输入框的内容。

从大纲中提取：
- 人物：林薇、赵玄冥。
- 事件：林薇在冷宫苏醒、皇帝驾临冷宫。
- 物件：镣铐、玄黑龙纹衣摆、冷宫厢房。
- 设定元素：穿越、恶魔血脉、三日斩首倒计时。`,
      { field: 'mustInclude', kind: 'list' }
    )

    expect(value).toEqual([
      '林薇、赵玄冥。',
      '林薇在冷宫苏醒、皇帝驾临冷宫。',
      '镣铐、玄黑龙纹衣摆、冷宫厢房。',
      '穿越、恶魔血脉、三日斩首倒计时。'
    ])
  })

  it('filters generated id lists by the available reference ids', () => {
    const value = parseChapterPlanFieldValue(
      `可用角色如下：
1. 角色ID 101：林薇
2. 角色ID 999：不存在角色，不应采纳
3. 102`,
      {
        field: 'characters',
        kind: 'numberList',
        allowedIds: new Set([101, 102])
      }
    )

    expect(value).toEqual([101, 102])
  })

  it('rejects meta analysis when a text field has no final usable value', () => {
    expect(() =>
      parseChapterPlanFieldValue(
        `首先，用户要求我作为专业的小说章节策划师，只生成【本章目标】输入框的内容。输出必须是中文正文，直接填入输入框，不要任何解释、分析、标题、前言或总结。不要JSON、代码块、字段名或markdown表格。

输入是小说标题、类型、世界观设定、写作风格、章节大纲和出场角色。章节是第1章「异世初逢」，大纲已经给出。

我需要写清本章主角要主动达成的具体目标。主角是林薇，穿越者，面临三日后斩首的命运。从大纲中，林薇在冷宫苏醒，皇帝赵玄冥来访，她内心计算如何利用皇帝的性格来撬动生机。

所以，本章目标应该聚焦于林薇在本章中主动要达成的具体目标。大纲中提到：`,
        { field: 'goal', kind: 'text' }
      )
    ).toThrow('本章目标缺少可填表正文')
  })

  it('extracts a concrete text value from model meta analysis candidate sentences', () => {
    const value = parseChapterPlanFieldValue(
      `首先，用户要求我只生成【本章目标】输入框的内容。这意味着我需要输出一段中文正文，直接填入输入框。

从邻近章节大纲中，我可以看到第1章的剧情：林薇穿书成恶毒女配，面临三日后斩首的命运，皇帝赵玄冥出现。

本章目标应该是主角林薇在冷宫苏醒后，迅速弄清自己穿书后的死局，并借皇帝赵玄冥驾临冷宫的机会试探他的性情，为摆脱三日后斩首命运撬开第一道生机。

具体来说，在第1章中，林薇苏醒后意识到自己的处境。`,
      { field: 'goal', kind: 'text' }
    )

    expect(value).toBe(
      '主角林薇在冷宫苏醒后，迅速弄清自己穿书后的死局，并借皇帝赵玄冥驾临冷宫的机会试探他的性情，为摆脱三日后斩首命运撬开第一道生机。'
    )
  })

  it('extracts a goal value from character-specific model reasoning', () => {
    const value = parseChapterPlanFieldValue(
      `首先，用户要求我只生成【本章目标】输入框的内容。输出必须是一段可直接填入输入框的中文正文，不要任何解释、分析、标题、前言或总结。

从邻近章节大纲中，第1章的内容是：林薇在冷宫苏醒，发现自己穿书成了恶毒女配，面临三日后斩首的命运。

关键点是：写清本章主角要主动达成的具体目标。主角是林薇，她需要主动达成的目标是什么？从大纲看，林薇的目标是改变斩首命运，在三日绝境中撬动一丝生机。`,
      { field: 'goal', kind: 'text' }
    )

    expect(value).toBe('改变斩首命运，在三日绝境中撬动一丝生机。')
  })

  it('extracts concrete text fields from verbose single-field reasoning', () => {
    const conflict = parseChapterPlanFieldValue(
      `好的，用户需要我生成小说第1章的核心冲突内容。用户要求只输出核心冲突的正文内容，不能有任何解释或额外文字。

从用户给的材料看，这一章是林薇刚穿越到冷宫，面临三天后斩首的绝境。核心冲突应该围绕林薇如何利用这个兴趣来争取生机。

我觉得核心冲突可以这样设计：林薇意识到皇帝对她产生了兴趣，但这份兴趣危险而玩味；她必须借此争取三日死局中的生机，又要承受皇后逼近、冷宫困局和皇帝残暴审视带来的反噬风险。`,
      { field: 'conflict', kind: 'text' }
    )
    const turningPoint = parseChapterPlanFieldValue(
      `首先，用户要求我只生成【关键转折】输入框的内容。

关键转折应该是一个具体事件或发现，导致局面发生变化。从大纲看，转折点可能是林薇抓住皇帝离开前那一瞥，意识到自己仍有被利用的价值，并决定反过来利用这种兴趣打破原书死局。`,
      { field: 'turningPoint', kind: 'text' }
    )
    const protocol = parseChapterPlanFieldValue(
      `首先，用户要求我只生成【称谓设定】输入框的内容。

从用户提供的上下文来看，故事发生在架空古代皇宫，出场角色有林薇、赵玄冥、李婉容。称谓设定需要保持后宫礼制：林薇对赵玄冥称“陛下”，旁人称李婉容为“皇后娘娘”，冷宫宫人与侍从不得使用现代口吻或越级称呼。`,
      { field: 'protocol', kind: 'text' }
    )

    expect(conflict).toBe(
      '林薇意识到皇帝对她产生了兴趣，但这份兴趣危险而玩味；她必须借此争取三日死局中的生机，又要承受皇后逼近、冷宫困局和皇帝残暴审视带来的反噬风险。'
    )
    expect(turningPoint).toBe(
      '林薇抓住皇帝离开前那一瞥，意识到自己仍有被利用的价值，并决定反过来利用这种兴趣打破原书死局。'
    )
    expect(protocol).toBe(
      '林薇对赵玄冥称“陛下”，旁人称李婉容为“皇后娘娘”，冷宫宫人与侍从不得使用现代口吻或越级称呼。'
    )
  })

  it('extracts usable text from verbose field analysis with directive wording', () => {
    const conflict = parseChapterPlanFieldValue(
      `首先，用户要求我只生成【核心冲突】输入框的内容。核心冲突应该聚焦于本章的外部压力和人物两难。

从章节大纲和已确认角色来看：
- 外部压力：林薇被囚禁在冷宫，面临三日后斩首的命运。
- 人物两难：林薇作为穿越者，内心恐惧但必须保持冷静。

所以，核心冲突应该描述林薇面临皇帝威压、斩首倒计时和皇后势力威胁，又要在恐惧本能与现代灵魂的冷静计算之间拉扯，借赵玄冥危险的兴趣争取生机。`,
      { field: 'conflict', kind: 'text' }
    )
    const pacing = parseChapterPlanFieldValue(
      `好的，用户需要我生成小说第1章的情绪节奏内容，直接填入输入框。

我觉得情绪推进应该分几个阶段：开篇以冷宫苏醒的混乱和恐惧起势，皇帝驾临时放慢节奏强化压迫，结尾转入冷静计算并保留斩首倒计时。`,
      { field: 'pacing', kind: 'text' }
    )

    expect(conflict).toBe(
      '林薇面临皇帝威压、斩首倒计时和皇后势力威胁，又要在恐惧本能与现代灵魂的冷静计算之间拉扯，借赵玄冥危险的兴趣争取生机。'
    )
    expect(pacing).toBe(
      '开篇以冷宫苏醒的混乱和恐惧起势，皇帝驾临时放慢节奏强化压迫，结尾转入冷静计算并保留斩首倒计时。'
    )
  })

  it('builds fallback field values from the chapter outline when model output is unusable', () => {
    const outline =
      '冷宫残破的厢房内，林薇在剧烈的头痛中苏醒，发现自己穿书成恶毒女配，因构陷宠妃罪行败露，被皇帝下令三日后于午门斩首。皇帝赵玄冥驾临，他居高临下地审视着阶下狼狈的林薇。皇帝拂袖而去前，那意味深长的一瞥，仿佛在衡量一件尚有价值的卑微猎物。'

    const goal = buildChapterPlanFieldFallback({
      field: 'goal',
      chapterOutline: '????????????',
      chapterNumber: 1,
      chapterTitle: '异世初逢',
      outlines: [{ chapterNumber: 1, description: outline }]
    })
    const beats = buildChapterPlanFieldFallback({
      field: 'beats',
      chapterOutline: outline
    })
    const protocol = buildChapterPlanFieldFallback({
      field: 'protocol',
      chapterOutline: outline
    })

    expect(goal).toContain('林薇')
    expect(goal).not.toContain('用户要求')
    expect(goal).not.toContain('输入框')
    expect(beats).toEqual(
      expect.arrayContaining([expect.stringContaining('冷宫')])
    )
    expect((beats as string[]).length).toBeGreaterThanOrEqual(3)
    expect(protocol).toContain('皇帝')
  })

  it('extracts the final usable value from text-field reasoning when present', () => {
    const value = parseChapterPlanFieldValue(
      `我需要写清关键转折。从大纲看，皇帝离开前的一瞥改变了局面。

最终内容：皇帝赵玄冥离开冷宫前意味深长的一瞥，让林薇意识到自己仍有被利用的价值，三日死局第一次出现裂缝。`,
      { field: 'turningPoint', kind: 'text' }
    )

    expect(value).toBe(
      '皇帝赵玄冥离开冷宫前意味深长的一瞥，让林薇意识到自己仍有被利用的价值，三日死局第一次出现裂缝。'
    )
  })

  it('rejects list-field category analysis without direct list items', () => {
    expect(() =>
      parseChapterPlanFieldValue(
        `*人物**：大纲中明确提到了林薇和赵玄冥。李婉容虽然被提及，但没有直接出场。
*事件**：大纲描述了林薇苏醒、记忆涌入、皇帝驾临、对话、皇帝离开等事件。`,
        { field: 'mustInclude', kind: 'list' }
      )
    ).toThrow('必须出现缺少可填表条目')
  })

  it('salvages core values from markdown field analysis without quoted suggestions', () => {
    const partial = parseChapterPlanPartialDraft(
      `首先，用户要求我只生成章节计划的「剧情骨架」部分，并且只返回严格 JSON 对象。JSON 的形状必须严格匹配：{"goal":"","conflict":"","turningPoint":"","beats":[],"interestHooks":[]}。

我需要根据提供的章节大纲、世界观设定和角色信息来填充这些字段。章节是第1章「异世初逢」，大纲已经给出。

- **goal**: 必须写成贴合本章大纲的具体剧情内容。本章的目标应该是林薇在冷宫中苏醒，面临斩首命运，并开始寻找生机。

- **conflict**: 同样，贴合本章大纲。冲突应该是林薇与皇帝赵玄冥的敌对关系，以及她面临的三日斩首倒计时。

- **turningPoint**: 转折点。在大纲中，皇帝赵玄冥驾临冷宫，审视林薇，并意味深长地一瞥，这可能是一个转折点，暗示皇帝对林薇产生兴趣。

- **beats**: 字符串数组，至少3条，每条是可执行剧情动作。这些应该是本章中的关键事件或动作。

- **interestHooks**: 字符串数组，写出章末或段落中的悬念、爽点或反转。例如，皇帝的一瞥可能是一个悬念。

从大纲中提取关键点：

- 林薇在冷宫苏醒，意识到穿书，面临三日斩首。
- 皇帝赵玄冥驾临，嘲讽审视，提及皇后李婉容的调查。
- 林薇内心计算，试图利用皇帝的性格。
- 皇帝离开前意味深长的一瞥。

现在，构建JSON字段：

1. **goal**: 本章的目标是林薇在冷宫中苏醒并意识到自己的处境，开始计划如何在三日内改变斩首命运。具体化：林薇在冷宫中苏醒，面对穿书现实和斩首倒计时，目标是找到生存策略。

2. **conflict**: 冲突是林薇与皇帝赵玄冥的敌对关系，以及皇后李婉容的威胁。具体化：林薇被囚禁冷宫，皇帝下令三日后斩首，皇后接管调查，证据确凿，林薇必须对抗这些压力。

3. **turningPoint**: 转折点是皇帝赵玄冥驾临冷宫，冷漠审视林薇，并在离开前投下意味深长的一瞥，让林薇意识到自己仍可能被利用。

4. **beats**:
   1. 林薇在冷宫苏醒，意识到自己穿书成恶毒女配。
   2. 皇帝赵玄冥驾临冷宫，嘲讽审视林薇并提及皇后调查。
   3. 林薇压下恐惧，借原主姿态狡辩并计算求生策略。

5. **interestHooks**: 皇帝离开前意味深长的一瞥暗示林薇并非毫无利用价值，三日斩首倒计时出现第一道裂缝。`,
      ['goal', 'conflict', 'turningPoint', 'beats', 'interestHooks']
    )

    expect(partial).toEqual({
      goal: '林薇在冷宫中苏醒，面对穿书现实和斩首倒计时，目标是找到生存策略。',
      conflict:
        '林薇被囚禁冷宫，皇帝下令三日后斩首，皇后接管调查，证据确凿，林薇必须对抗这些压力。',
      turningPoint:
        '皇帝赵玄冥驾临冷宫，冷漠审视林薇，并在离开前投下意味深长的一瞥，让林薇意识到自己仍可能被利用。',
      beats: [
        '林薇在冷宫苏醒，意识到自己穿书成恶毒女配。',
        '皇帝赵玄冥驾临冷宫，嘲讽审视林薇并提及皇后调查。',
        '林薇压下恐惧，借原主姿态狡辩并计算求生策略。'
      ],
      interestHooks: [
        '皇帝离开前意味深长的一瞥暗示林薇并非毫无利用价值，三日斩首倒计时出现第一道裂缝。'
      ]
    })
  })

  it('parses a constraints partial wrapped by the model section title', () => {
    const partial = parseChapterPlanPartialDraft(
      '{"constraints":{"mustInclude":["冷宫汤药"],"avoid":["不要提前揭露幕后黑手"],"pacing":"紧张克制","protocol":"宫廷称谓谨慎","continuityRisks":[]}}',
      ['mustInclude', 'avoid', 'pacing', 'protocol', 'continuityRisks']
    )

    expect(partial).toEqual({
      mustInclude: ['冷宫汤药'],
      avoid: ['不要提前揭露幕后黑手'],
      pacing: '紧张克制',
      protocol: '宫廷称谓谨慎'
    })
  })

  it('parses a references partial wrapped by the model section title', () => {
    const partial = parseChapterPlanPartialDraft(
      '{"引用状态":{"characters":[101,102],"characterStateDeltas":["林晚更谨慎"],"plotThreadActions":[301],"foreshadowingActions":[401]}}',
      [
        'characters',
        'characterStateDeltas',
        'plotThreadActions',
        'foreshadowingActions'
      ]
    )

    expect(partial).toEqual({
      characters: [101, 102],
      characterStateDeltas: ['林晚更谨慎'],
      plotThreadActions: [301],
      foreshadowingActions: [401]
    })
  })

  it('reports a targeted error when a partial plan has no allowed content', () => {
    expect(() =>
      parseChapterPlanPartialDraft('{"characters":[1]}', ['goal', 'beats'])
    ).toThrow('AI 未返回可用的剧情计划：剧情骨架缺少可用字段')
  })

  it('accepts an empty references partial because reference fields are optional', () => {
    const partial = parseChapterPlanPartialDraft(
      '{"characters":[],"characterStateDeltas":[],"plotThreadActions":[],"foreshadowingActions":[]}',
      [
        'characters',
        'characterStateDeltas',
        'plotThreadActions',
        'foreshadowingActions'
      ]
    )

    expect(partial).toEqual({
      characters: [],
      characterStateDeltas: [],
      plotThreadActions: [],
      foreshadowingActions: []
    })
  })

  it('merges section partials into a full plan with safe defaults', () => {
    const plan = mergeChapterPlanPartials([
      {
        goal: '稳住冷宫局面',
        conflict: '隐藏异常与自保冲突',
        turningPoint: '药渣被调包',
        beats: ['醒来确认身份'],
        interestHooks: ['药渣指向御前人']
      },
      {
        mustInclude: ['冷宫汤药'],
        avoid: ['不要提前揭露幕后黑手'],
        pacing: '紧张克制',
        protocol: '宫廷称谓谨慎'
      },
      {
        characters: [101],
        characterStateDeltas: ['林晚更谨慎']
      }
    ])

    expect(plan).toEqual({
      goal: '稳住冷宫局面',
      conflict: '隐藏异常与自保冲突',
      turningPoint: '药渣被调包',
      beats: ['醒来确认身份'],
      mustInclude: ['冷宫汤药'],
      avoid: ['不要提前揭露幕后黑手'],
      characters: [101],
      characterStateDeltas: ['林晚更谨慎'],
      plotThreadActions: [],
      foreshadowingActions: [],
      interestHooks: ['药渣指向御前人'],
      continuityRisks: [],
      pacing: '紧张克制',
      protocol: '宫廷称谓谨慎'
    })
  })

  it('accepts a plan with goal, conflict, turning point and hooks', () => {
    const result = validateChapterPlanDraft(validPlan(), context)

    expect(result.blocked).toBe(false)
    expect(result.issues).toEqual([])
  })

  it('blocks plans without a concrete conflict or turning point', () => {
    const result = validateChapterPlanDraft(
      validPlan({ conflict: '', turningPoint: '' }),
      context
    )

    expect(result.blocked).toBe(true)
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing_conflict',
          severity: 'error'
        }),
        expect.objectContaining({
          code: 'missing_turning_point',
          severity: 'error'
        })
      ])
    )
  })

  it('blocks plans that copy schema placeholder text', () => {
    const result = validateChapterPlanDraft(
      validPlan({
        goal: '本章要推进的核心目标',
        conflict: '本章核心冲突或两难选择',
        turningPoint: '本章关键转折',
        beats: ['剧情节拍1', '剧情节拍2', '剧情节拍3'],
        mustInclude: ['必须出现的人物、事件、物件'],
        avoid: ['需要避免提前揭露或避免出场的内容'],
        interestHooks: ['章末或段落中的悬念/爽点/反转'],
        pacing: '情绪与节奏要求',
        protocol: '称谓、身份、礼制或设定补充'
      }),
      context
    )

    expect(result.blocked).toBe(true)
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'template_placeholder',
          severity: 'error'
        })
      ])
    )
    expect(hasInvalidGeneratedPlanIssue(result.issues)).toBe(true)
  })

  it('warns when the plan has no interest hook', () => {
    const result = validateChapterPlanDraft(
      validPlan({ interestHooks: [] }),
      context
    )

    expect(result.blocked).toBe(false)
    expect(hasInvalidGeneratedPlanIssue(result.issues)).toBe(false)
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'missing_interest_hook',
        severity: 'warning'
      })
    ])
  })

  it('blocks references to missing characters, plot points and foreshadowing', () => {
    const result = validateChapterPlanDraft(
      validPlan({
        characters: [1, 99],
        plotThreadActions: [10, 88],
        foreshadowingActions: [20, 77]
      }),
      context
    )

    expect(result.blocked).toBe(true)
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unknown_character',
          severity: 'error'
        }),
        expect.objectContaining({
          code: 'unknown_plot_point',
          severity: 'error'
        }),
        expect.objectContaining({
          code: 'unknown_foreshadowing',
          severity: 'error'
        })
      ])
    )
  })

  it('blocks high continuity risks before generation tasks are created', () => {
    const result = validateChapterPlanDraft(
      validPlan({ continuityRisks: ['高风险：本章提前泄露最终反派身份'] }),
      context
    )

    expect(result.blocked).toBe(true)
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'high_continuity_risk',
        severity: 'error'
      })
    ])
  })
})
