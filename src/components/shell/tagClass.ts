import type { TagColor } from '@/lib/db'

export const tagBg: Record<TagColor, string> = {
  1: 'bg-tag-1',
  2: 'bg-tag-2',
  3: 'bg-tag-3',
  4: 'bg-tag-4',
  5: 'bg-tag-5',
  6: 'bg-tag-6',
}
export const tagClass = (c: TagColor) => tagBg[c]
