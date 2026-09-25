import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { FilterIcon, PinIcon, SearchIcon, SortDateIcon } from './icons'
import { files, pinnedFiles, selectedFile, type SampleFile } from './sample'
import { TagMark } from './TagMark'

function IconButton({ title, children }: { title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      className="flex h-5 w-6 items-center justify-center rounded-md border border-border bg-control text-secondary-foreground"
    >
      {children}
    </button>
  )
}

function FileRow({ file }: { file: SampleFile }) {
  const selected = file.name === selectedFile
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-l-2 py-[5px] pr-3 pl-2.5',
        selected ? 'border-primary bg-popover' : 'border-transparent',
      )}
    >
      <TagMark slot={file.tag} className="size-2" />
      <span className="flex w-[7px] flex-none text-secondary-foreground">{file.pinned && <PinIcon />}</span>
      <span
        className={cn(
          'flex-auto truncate text-[13px]',
          selected ? 'font-medium text-foreground' : 'text-secondary-foreground',
        )}
      >
        {file.name}
      </span>
      <span className="font-mono text-[11px] text-muted-foreground">{file.age}</span>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="flex min-h-0 w-[248px] flex-none flex-col overflow-hidden rounded-(--radius-panel) border border-border-strong bg-card">
      <header className="flex h-[38px] flex-none items-center gap-[5px] border-b border-border pr-2 pl-3.5">
        <span className="flex-auto font-mono text-[13.5px] font-semibold tracking-(--wordmark-tracking) text-foreground">
          jot
        </span>
        <IconButton title="sorted by date, newest first">
          <SortDateIcon />
        </IconButton>
        <IconButton title="filter by color">
          <FilterIcon />
        </IconButton>
        <IconButton title="search">
          <SearchIcon />
        </IconButton>
      </header>

      <div className="flex flex-auto flex-col overflow-hidden">
        <div className="flex flex-col border-b border-border py-1.5">
          {pinnedFiles.map((f) => (
            <FileRow key={f.name} file={f} />
          ))}
        </div>
        <div className="flex flex-col py-1.5">
          {files.map((f) => (
            <FileRow key={f.name} file={f} />
          ))}
        </div>
      </div>
    </aside>
  )
}
