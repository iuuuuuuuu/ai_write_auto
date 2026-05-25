import type { Pipeline } from '@huggingface/transformers'

const MODEL_ID = 'Xenova/bge-small-zh-v1.5'
const EMBEDDING_DIM = 512
const MODEL_CACHE_DIR = './data/models'

function isInChina(): boolean {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const lang = process.env.LANG || process.env.LANGUAGE || ''
  return tz === 'Asia/Shanghai' || tz === 'Asia/Chongqing' || lang.startsWith('zh')
}

let pipeline: Pipeline | null = null
let status: 'idle' | 'downloading' | 'ready' | 'error' = 'idle'
let progress = 0
let errorMessage = ''
let loadingPromise: Promise<void> | null = null

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
  if (loadingPromise) return loadingPromise

  loadingPromise = doLoadModel()
  try {
    await loadingPromise
  } finally {
    loadingPromise = null
  }
}

async function doLoadModel(): Promise<void> {
  status = 'downloading'
  progress = 0
  errorMessage = ''

  try {
    const { pipeline: createPipeline, env } = await import('@huggingface/transformers')
    env.cacheDir = MODEL_CACHE_DIR
    ;(env as any).logLevel = 'error'
    if (process.env.HF_ENDPOINT) {
      env.remoteHost = process.env.HF_ENDPOINT
    } else if (!process.env.HF_ENDPOINT && isInChina()) {
      env.remoteHost = 'https://hf-mirror.com'
    }

    let lastLoggedProgress = 0
    const startTime = Date.now()

    pipeline = await createPipeline('feature-extraction', MODEL_ID, {
      dtype: 'fp32',
      progress_callback: (p: any) => {
        if (p.status === 'progress' && p.progress != null) {
          progress = Math.round(p.progress)
          if (progress - lastLoggedProgress >= 10) {
            lastLoggedProgress = progress
            console.log(`[embedding] Downloading model... ${progress}%`)
          }
        }
        if (p.status === 'done' && p.file) {
          console.log(`[embedding] Downloaded: ${p.file}`)
        }
      }
    }) as Pipeline

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    status = 'ready'
    progress = 100
    console.log(`[embedding] ✓ Model ready (${MODEL_ID}, fp32, ${elapsed}s)`)
  } catch (err) {
    status = 'error'
    errorMessage = err instanceof Error ? err.message : 'Model load failed'
    console.error('[embedding] ✗ Failed to load model:', errorMessage)
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

export function tryAutoLoadEmbedding() {
  console.log('[embedding] Auto-loading model on startup...')
  ensureModel().catch((err) => {
    console.warn('[embedding] Auto-load failed (will retry on first use):', err.message)
  })
}
