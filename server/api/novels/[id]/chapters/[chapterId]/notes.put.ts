import { NovelSchema, ChapterNoteSchema } from '../../../../../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = Number(getRouterParam(event, 'id'))
  const chapterId = Number(getRouterParam(event, 'chapterId'))
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const { content } = await readBody(event)

  let note = await em.findOne(ChapterNoteSchema, { chapter: chapterId })

  if (note) {
    note.content = content
  } else {
    note = em.create(ChapterNoteSchema, {
      chapter: chapterId,
      content: content || '',
    })
    em.persist(note)
  }

  await em.flush()
  return note
})
