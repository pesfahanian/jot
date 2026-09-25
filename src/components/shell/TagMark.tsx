import { cn } from '@/lib/utils'
import type { TagSlot } from './sample'

const slotClass: Record<TagSlot, string> = {
  1: 'bg-tag-1',
  2: 'bg-tag-2',
  3: 'bg-tag-3',
  4: 'bg-tag-4',
  5: 'bg-tag-5',
  6: 'bg-tag-6',
}

// Fixed slot: an untagged row still reserves the square so names align (§1.9).
export function TagMark({ slot, className }: { slot?: TagSlot; className?: string }) {
  return <span className={cn('flex-none rounded-[2px]', slot && slotClass[slot], className)} />
}
