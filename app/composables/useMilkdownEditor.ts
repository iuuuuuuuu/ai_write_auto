import { ref, onBeforeUnmount } from 'vue'
import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx,
  schemaCtx
} from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { nord } from '@milkdown/theme-nord'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { replaceAll } from '@milkdown/utils'
import type { Ctx } from '@milkdown/ctx'

export interface UseMilkdownEditorOptions {
  onChange?: (markdown: string) => void
}

export function useMilkdownEditor(options: UseMilkdownEditorOptions = {}) {
  const containerRef = ref<HTMLDivElement | null>(null)
  const editorRef = ref<InstanceType<typeof Editor> | null>(null)
  const markdownRef = ref('')
  const isReady = ref(false)

  let editorInstance: InstanceType<typeof Editor> | null = null

  async function createEditor(initialMarkdown: string = '') {
    if (!containerRef.value) return
    if (editorInstance) {
      await editorInstance.destroy()
      editorInstance = null
    }

    editorInstance = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, containerRef.value!)
        ctx.set(defaultValueCtx, initialMarkdown)
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) {
            markdownRef.value = markdown
            options.onChange?.(markdown)
          }
        })
      })
      .use(nord as any)
      .use(commonmark as any)
      .use(listener as any)
      .create()

    editorRef.value = editorInstance
    isReady.value = true
    markdownRef.value = initialMarkdown
  }

  async function setMarkdown(markdown: string) {
    if (!editorInstance) return
    await editorInstance.action(replaceAll(markdown))
    markdownRef.value = markdown
  }

  function getMarkdown(): string {
    return markdownRef.value
  }

  function getPlainText(): string {
    return markdownRef.value
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*|__/g, '')
      .replace(/\*|_/g, '')
      .replace(/`{1,3}/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/\n+/g, '\n')
      .trim()
  }

  function getSelectionText(): string | null {
    if (!editorInstance) return null
    let selected: string | null = null
    editorInstance.action((ctx: Ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state } = view
      const { selection } = state
      if (!selection.empty) {
        selected = state.doc.textBetween(selection.from, selection.to)
      }
    })
    return selected
  }

  function getSelectionRange(): { from: number; to: number } | null {
    if (!editorInstance) return null
    let range: { from: number; to: number } | null = null
    editorInstance.action((ctx: Ctx) => {
      const view = ctx.get(editorViewCtx)
      const { selection } = view.state
      if (!selection.empty) {
        range = { from: selection.from, to: selection.to }
      }
    })
    return range
  }

  function restoreSelectionRange(range: { from: number; to: number }) {
    if (!editorInstance) return
    editorInstance.action((ctx: Ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state } = view
      const { tr } = state
      const $from = state.doc.resolve(range.from)
      const SelClass = state.selection.constructor as any
      const selection = SelClass.near ? SelClass.near($from) : state.selection
      view.dispatch(tr.setSelection(selection))
      view.focus()
    })
  }

  function replaceSelection(text: string) {
    if (!editorInstance) return
    editorInstance.action((ctx: Ctx) => {
      const view = ctx.get(editorViewCtx)
      const schema = ctx.get(schemaCtx)
      const { state } = view
      const { selection, tr } = state
      const textNode = schema.text(text)
      view.dispatch(tr.replaceWith(selection.from, selection.to, textNode))
      view.focus()
    })
  }

  function insertTextAtCursor(text: string) {
    if (!editorInstance) return
    editorInstance.action((ctx: Ctx) => {
      const view = ctx.get(editorViewCtx)
      const schema = ctx.get(schemaCtx)
      const { state } = view
      const { selection, tr } = state
      const textNode = schema.text(text)
      view.dispatch(tr.insert(selection.from, textNode))
      view.focus()
    })
  }

  function focus() {
    if (!editorInstance) return
    editorInstance.action((ctx: Ctx) => {
      const view = ctx.get(editorViewCtx)
      view.focus()
    })
  }

  function getCursorClientPos(): { x: number; y: number } | null {
    if (!editorInstance) return null
    let pos: { x: number; y: number } | null = null
    editorInstance.action((ctx: Ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state } = view
      const { selection } = state
      try {
        const coords = view.coordsAtPos(selection.from)
        pos = { x: coords.left + (coords.right - coords.left) / 2, y: coords.top }
      } catch {
        pos = null
      }
    })
    return pos
  }

  function getContextBeforeCursor(maxChars = 2000): string {
    if (!editorInstance) return ''
    let text = ''
    editorInstance.action((ctx: Ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state } = view
      const { selection } = state
      text = state.doc.textBetween(0, selection.from)
    })
    if (text.length > maxChars) {
      text = text.slice(-maxChars)
    }
    return text
  }

  function setEditable(editable: boolean) {
    if (!editorInstance) return
    editorInstance.action((ctx: Ctx) => {
      const view = ctx.get(editorViewCtx)
      view.setProps({ editable: () => editable })
    })
  }

  async function destroy() {
    if (editorInstance) {
      await editorInstance.destroy()
      editorInstance = null
      editorRef.value = null
      isReady.value = false
    }
  }

  onBeforeUnmount(destroy)

  return {
    containerRef,
    editorRef,
    isReady,
    createEditor,
    setMarkdown,
    getMarkdown,
    getPlainText,
    getSelectionText,
    getSelectionRange,
    restoreSelectionRange,
    replaceSelection,
    insertTextAtCursor,
    focus,
    getCursorClientPos,
    getContextBeforeCursor,
    setEditable,
    destroy
  }
}
