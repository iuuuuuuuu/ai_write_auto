import { parentPort } from 'node:worker_threads'

const originalWarn = console.warn
console.warn = (...args) => {
  const msg = args.join(' ')
  if (msg.includes('content-length')) return
  originalWarn.apply(console, args)
}

let pipe = null
let config = {}

parentPort.on('message', async (msg) => {
  if (msg.type === 'init') {
    config = msg.config || {}
  } else if (msg.type === 'load') {
    try {
      const { pipeline: createPipeline, env } = await import('@huggingface/transformers')

      env.cacheDir = config.cacheDir || './data/models'
      env.logLevel = 'error'
      if (config.remoteHost) {
        env.remoteHost = config.remoteHost
      }

      const startTime = Date.now()
      parentPort.postMessage({ type: 'log', message: '[embedding] Loading model in worker thread...' })

      pipe = await createPipeline('feature-extraction', config.modelId || 'Xenova/bge-small-zh-v1.5', {
        dtype: 'fp32',
        progress_callback: (p) => {
          if (p.status === 'progress' && p.progress != null) {
            parentPort.postMessage({ type: 'progress', progress: Math.round(p.progress) })
          }
          if (p.status === 'done' && p.file) {
            parentPort.postMessage({ type: 'downloaded', file: p.file })
          }
        }
      })

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      parentPort.postMessage({ type: 'ready', elapsed })
    } catch (err) {
      parentPort.postMessage({ type: 'error', error: err.message })
    }
  } else if (msg.type === 'embed') {
    if (!pipe) {
      parentPort.postMessage({ type: 'embed-error', id: msg.id, error: 'Model not loaded' })
      return
    }
    try {
      const results = []
      for (const text of msg.texts) {
        const output = await pipe(text, { pooling: 'mean', normalize: true })
        results.push(Array.from(output.data))
      }
      parentPort.postMessage({ type: 'embed-result', id: msg.id, results })
    } catch (err) {
      parentPort.postMessage({ type: 'embed-error', id: msg.id, error: err.message })
    }
  }
})
