import { getDatabase, type Database } from '../database'

export async function useDb(): Promise<Database> {
  return getDatabase()
}
