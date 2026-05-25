import { Worker } from 'node:worker_threads'
import { resolve, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const MODEL_ID = 'Xenova/bge-small-zh-v1.5'
const EMBEDDING_DIM = 512
const MODEL_CACHE_DIR = './data/models'

function isInChina(): boolean {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const lang = process.env.LANG || process.env.LANGUAGE || ''
  return tz === 'Asia/Shanghai' || tz === 'Asia/Chongqing' || lang.startsWith('zh')
}

let worker: Worker | null = null
let status: 'idle' | 'downloading' | 'ready' | 'error' = 'idle'
let progress = 0
let errorMessage = ''
let embedIdCounter = 0
const pendingEmbeds = new Map<number, { resolve: (v: Float32Array[]) => void; reject: (e: Error) => void }>()
const readyCallbacks: Array<{ resolve: () => void; reject: (e: Error) => void }> = []

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
  if (status === 'error') throw new Error(errorMessage)

  if (status === 'idle') {
    spawnWorker()
  }

  return new Promise<void>((res, rej) => {
    readyCallbacks.push({ resolve: res, reject: rej })
  })
}

function resolveWorkerPath(): string {
  // Production: bundled alongside server chunks
  const prodPath = resolve(process.cwd(), '.output/server/embedding-worker.mjs')
  if (existsSync(prodPath)) return prodPath

  // Dev: relative to this file's source location
  const devPath = resolve(process.cwd(), 'server/services/embedding-worker.mjs')
  if (existsSync(devPath)) return devPath

  return devPath
}

function spawnWorker() {
  if (worker || status === 'downloading') return
  status = 'downloading'
  progress = 0
  errorMessage = ''

  const workerPath = resolveWorkerPath()

  try {
    worker = new Worker(workerPath)
  } catch (err: any) {
    status = 'error'
    errorMessage = `Failed to spawn worker: ${err.message}`
    console.error('[embedding] ✗', errorMessage)
    flushReadyCallbacks(new Error(errorMessage))
    return
  }

  const remoteHost = process.env.HF_ENDPOINT || (isInChina() ? 'https://hf-mirror.com' : undefined)

  worker.postMessage({
    type: 'init',
    config: {
      modelId: MODEL_ID,
      cacheDir: MODEL_CACHE_DIR,
      remoteHost
    }
  })

  worker.on('message', (msg) => {
    switch (msg.type) {
      case 'log':
        console.log(msg.message)
        break
      case 'progress':
        if (msg.progress > progress) {
          progress = msg.progress
          if (progress % 25 === 0 && progress < 100) {
            console.log(`[embedding] Downloading model... ${progress}%`)
          }
        }
        break
      case 'downloaded':
        console.log(`[embedding] Downloaded: ${msg.file}`)
        break
      case 'ready':
        status = 'ready'
        progress = 100
        console.log(`[embedding] ✓ Model ready (worker thread, ${msg.elapsed}s)`)
        flushReadyCallbacks(null)
        break
      case 'error':
        status = 'error'
        errorMessage = msg.error
        console.error('[embedding] ✗ Failed to load model:', msg.error)
        flushReadyCallbacks(new Error(msg.error))
        terminateWorker()
        break
      case 'embed-result': {
        const pending = pendingEmbeds.get(msg.id)
        if (pending) {
          pendingEmbeds.delete(msg.id)
          pending.resolve(msg.results.map((r: number[]) => new Float32Array(r)))
        }
        break
      }
      case 'embed-error': {
        const pending = pendingEmbeds.get(msg.id)
        if (pending) {
          pendingEmbeds.delete(msg.id)
          pending.reject(new Error(msg.error))
        }
        break
      }
    }
  })

  worker.on('error', (err) => {
    console.error('[embedding] Worker crashed:', err.message)
    status = 'error'
    errorMessage = err.message
    flushReadyCallbacks(new Error(err.message))
    worker = null
  })

  worker.on('exit', (code) => {
    if (code !== 0 && status !== 'ready') {
      status = 'error'
      errorMessage = `Worker exited with code ${code}`
      flushReadyCallbacks(new Error(errorMessage))
    }
    worker = null
  })

  // Tell worker to start loading
  worker.postMessage({ type: 'load' })
}

function terminateWorker() {
  worker?.terminate()
  worker = null
}

function flushReadyCallbacks(err: Error | null) {
  const cbs = readyCallbacks.splice(0)
  for (const cb of cbs) {
    if (err) cb.reject(err)
    else cb.resolve()
  }
}

export async function embed(texts: string[]): Promise<Float32Array[]> {
  if (status !== 'ready') {
    await ensureModel()
  }
  if (!worker) throw new Error('Embedding worker not available')

  const id = ++embedIdCounter
  return new Promise<Float32Array[]>((resolve, reject) => {
    pendingEmbeds.set(id, { resolve, reject })
    worker!.postMessage({ type: 'embed', id, texts })
  })
}

export async function embedSingle(text: string): Promise<Float32Array> {
  const results = await embed([text])
  if (!results[0]) throw new Error('Embedding returned empty result')
  return results[0]
}

export function tryAutoLoadEmbedding() {
  console.log('[embedding] Starting model load in worker thread...')
  spawnWorker()
}
