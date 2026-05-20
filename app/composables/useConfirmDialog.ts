import { useDialog } from 'naive-ui'

export function useConfirmDialog() {
  const dialog = useDialog()

  function confirm(options: {
    title: string
    content: string
    type?: 'warning' | 'error' | 'info'
    positiveText?: string
    negativeText?: string
  }): Promise<boolean> {
    return new Promise((resolve) => {
      dialog[options.type || 'warning']({
        title: options.title,
        content: options.content,
        positiveText: options.positiveText || '确认',
        negativeText: options.negativeText || '取消',
        onPositiveClick: () => resolve(true),
        onNegativeClick: () => resolve(false),
        onClose: () => resolve(false),
      })
    })
  }

  function confirmDelete(itemName: string, count?: number): Promise<boolean> {
    const content = count
      ? `确定要删除选中的 ${count} 项吗？此操作不可撤销。`
      : `确定要删除「${itemName}」吗？此操作不可撤销。`

    return confirm({
      title: '确认删除',
      content,
      type: 'error',
      positiveText: '删除',
    })
  }

  return { confirm, confirmDelete }
}
