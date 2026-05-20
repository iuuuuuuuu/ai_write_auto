import type { Pipeline } from '@huggingface/transformers'

const MODEL_ID = 'Xenova/bge-small-zh-v1.5'
const EMBEDDING_DIM = 512

let pipeline: Pipeline | null = null
let status: 'idle' | 'downloading' | 'ready' | 'error' = 'idle'
let progress = 0
let errorMessage = ''

export function getEmbeddingDim(): number {
  return EMBEDDING_DIM
}

export function getEmbeddingStatus() {
  return { status, progress, error: errorMessage }
}

export function isEmbeddingReady(): boolean {
  return status === 'ready'
}

export async function ensureModel(): Promise<void> {
  if (status === 'ready') return
  if (status === 'downloading') return

  status = 'downloading'
  progress = 0
  errorMessage = ''

  try {
    const { pipeline: createPipeline, env } = await import('@huggingface/transformers')
    env.cacheDir = './data/models'

    pipeline = await createPipeline('feature-extraction', MODEL_ID, {
      progress_callback: (p: any) => {
        if (p.status === 'progress' && p.progress != null) {
          progress = Math.round(p.progress)
        }
      }
    }) as Pipeline

    status = 'ready'
    progress = 100
    console.log('[embedding] Model loaded:', MODEL_ID)
  } catch (err) {
    status = 'error'
    errorMessage = err instanceof Error ? err.message : 'Model load failed'
    console.error('[embedding] Failed to load model:', err)
    throw err
  }
}
export async function embed(texts: string[]): Promise<Float32Array[]> {
  if (!pipeline) {
    await ensureModel()
  }
  if (!pipeline) throw new Error('Embedding model not available')

  const results: Float32Array[] = []
  for (const text of texts) {
    const output = await (pipeline as any)(text, { pooling: 'mean', normalize: true })
    results.push(new Float32Array(output.data))
  }
  return results
}

export async function embedSingle(text: string): Promise<Float32Array> {
  const results = await embed([text])
  if (!results[0]) throw new Error('Embedding returned empty result')
  return results[0]
}
