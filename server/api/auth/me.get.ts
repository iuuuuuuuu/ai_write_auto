export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  return {
    user: {
      id: auth.userId,
      username: auth.username,
      role: auth.role,
    },
  }
})
