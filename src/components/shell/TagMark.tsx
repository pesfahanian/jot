import type { TagColor } from '@/lib/db'
import { cn } from '@/lib/utils'
import { tagClass } from './tagClass'

// Fixed slot: an untagged row still reserves the square so names align (§1.9).
export function TagMark({ color, className }: { color: TagColor | null; className?: string }) {
  return <span className={cn('flex-none rounded-[2px]', color && tagClass(color), className)} />
}
