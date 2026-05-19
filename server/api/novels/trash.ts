export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const method = getMethod(event)
  const em = useEm(event)

  if (method === 'GET') {
    const novels = await em.find('Novel', {
      user: auth.userId,
      deletedAt: { $ne: null },
    })

    const chapters = await em.find('Chapter', {
      novel: { user: auth.userId },
      deletedAt: { $ne: null },
    }, {
      populate: ['novel'],
    })

    return { novels, chapters }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const { type, id } = body

    if (type === 'novel') {
      const novel = await em.findOne('Novel', {
        id,
        user: auth.userId,
      })

      if (!novel) {
        throw createError({ statusCode: 404, message: 'Not found' })
      }

      novel.deletedAt = null
      await em.nativeUpdate('Chapter', { novel: id }, { deletedAt: null })
      await em.flush()
      return { success: true }
    }

    if (type === 'chapter') {
      const chapter = await em.findOne('Chapter', {
        id,
        novel: { user: auth.userId },
      })

      if (!chapter) {
        throw createError({ statusCode: 404, message: 'Not found' })
      }

      chapter.deletedAt = null
      await em.flush()
      return { success: true }
    }

    throw createError({ statusCode: 400, message: 'Invalid type' })
  }
})
