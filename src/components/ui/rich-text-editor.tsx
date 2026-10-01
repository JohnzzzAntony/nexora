"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Mention from "@tiptap/extension-mention"
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion"
import { Bold, Code2, Italic, Link2, List, ListOrdered, Loader2, Quote, Redo2, Undo2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/ui/user-avatar"
import { cn } from "@/lib/utils"

export type MentionUser = { id: string; name: string; avatarUrl?: string | null }

export type RichTextEditorHandle = {
  focus: () => void
  clear: () => void
  getHTML: () => string
  getMentionIds: () => string[]
  isEmpty: () => boolean
}

export type RichTextEditorProps = {
  /** Initial / controlled HTML. When changed externally (e.g. reset to ""), the editor content is replaced. */
  value?: string
  /** Emits HTML (sanitize server-side before storing) and the unique mentioned user ids. */
  onChange?: (html: string, mentionIds: string[]) => void
  placeholder?: string
  /** Enables @mentions. */
  searchUsers?: (query: string) => Promise<MentionUser[]>
  /** Ctrl/Cmd+Enter handler (e.g. submit a reply). */
  onSubmit?: () => void
  disabled?: boolean
  autoFocus?: boolean
  /** Min height of the editable area, CSS value. Default "8rem". */
  minHeight?: string
  /** Renders a hidden input with this name containing the HTML (for <form> posts). */
  name?: string
  className?: string
  "aria-label"?: string
  ref?: React.Ref<RichTextEditorHandle>
}

type MenuState = {
  items: MentionUser[]
  command: (attrs: { id: string; label: string }) => void
  rect: DOMRect | null
  index: number
  loading: boolean
}

/** Mutable holder read by Tiptap callbacks; keeps latest props without re-creating the editor. */
class EditorBridge {
  search: RichTextEditorProps["searchUsers"]
  onChange: RichTextEditorProps["onChange"]
  onSubmit: RichTextEditorProps["onSubmit"]
  menu: MenuState | null = null
  lastEmitted: string
  private onMenu: (next: MenuState | null) => void

  constructor(init: Pick<RichTextEditorProps, "searchUsers" | "onChange" | "onSubmit"> & { value: string; onMenu: (next: MenuState | null) => void }) {
    this.search = init.searchUsers
    this.onChange = init.onChange
    this.onSubmit = init.onSubmit
    this.lastEmitted = init.value
    this.onMenu = init.onMenu
  }

  sync(p: Pick<RichTextEditorProps, "searchUsers" | "onChange" | "onSubmit">) {
    this.search = p.searchUsers
    this.onChange = p.onChange
    this.onSubmit = p.onSubmit
  }

  setLastEmitted(v: string) {
    this.lastEmitted = v
  }

  updateMenu(next: MenuState | null) {
    this.menu = next
    this.onMenu(next)
  }
}

const EMPTY_HTML = "<p></p>"

function collectMentionIds(editor: Editor) {
  const ids = new Set<string>()
  editor.state.doc.descendants(node => {
    if (node.type.name === "mention" && node.attrs.id) ids.add(String(node.attrs.id))
  })
  return [...ids]
}

function normalize(html: string) {
  return html === EMPTY_HTML ? "" : html
}

function isSafeUrl(url: string) {
  return /^(https?:\/\/|mailto:)/i.test(url)
}

function ToolbarButton({
  label,
  active,
  onClick,
  disabled,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "text-muted-foreground hover:bg-accent hover:text-foreground flex size-7 items-center justify-center rounded transition-colors disabled:opacity-40 [&_svg]:size-4",
        active && "bg-accent text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function LinkButton({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [url, setUrl] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const active = useEditorState({ editor, selector: s => s.editor.isActive("link") })

  const apply = () => {
    const trimmed = url.trim()
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      setOpen(false)
      return
    }
    const href = /^[a-z]+:/i.test(trimmed) ? trimmed : `https://${trimmed}`
    if (!isSafeUrl(href)) {
      setError("Only http, https and mailto links are allowed")
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={o => {
        setOpen(o)
        if (o) {
          setUrl((editor.getAttributes("link").href as string | undefined) ?? "")
          setError(null)
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          disabled={disabled}
          aria-label="Link"
          title="Link"
          aria-pressed={active}
          className={cn(
            "text-muted-foreground hover:bg-accent hover:text-foreground flex size-7 items-center justify-center rounded transition-colors disabled:opacity-40 [&_svg]:size-4",
            active && "bg-accent text-foreground"
          )}
        >
          <Link2 />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <form
          className="space-y-2"
          onSubmit={e => {
            e.preventDefault()
            apply()
          }}
        >
          <Input autoFocus placeholder="https://example.com" value={url} onChange={e => setUrl(e.target.value)} aria-label="Link URL" aria-invalid={!!error} />
          {error && <p className="text-destructive text-xs">{error}</p>}
          <div className="flex justify-end gap-2">
            {active && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run()
                  setOpen(false)
                }}
              >
                Remove
              </Button>
            )}
            <Button type="submit" size="xs">
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

function Toolbar({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      code: e.isActive("codeBlock"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1" role="toolbar" aria-label="Formatting">
      <ToolbarButton label="Bold (Ctrl+B)" active={s.bold} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold />
      </ToolbarButton>
      <ToolbarButton label="Italic (Ctrl+I)" active={s.italic} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic />
      </ToolbarButton>
      <LinkButton editor={editor} disabled={disabled} />
      <span className="bg-border mx-1 h-4 w-px" aria-hidden />
      <ToolbarButton label="Bulleted list" active={s.bullet} disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={s.ordered} disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered />
      </ToolbarButton>
      <ToolbarButton label="Quote" active={s.quote} disabled={disabled} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote />
      </ToolbarButton>
      <ToolbarButton label="Code block" active={s.code} disabled={disabled} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Code2 />
      </ToolbarButton>
      <span className="ml-auto" />
      <ToolbarButton label="Undo" disabled={disabled || !s.canUndo} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 />
      </ToolbarButton>
      <ToolbarButton label="Redo" disabled={disabled || !s.canRedo} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 />
      </ToolbarButton>
    </div>
  )
}

function MentionMenu({ menu, onPick }: { menu: MenuState; onPick: (i: number) => void }) {
  if (typeof document === "undefined" || !menu.rect) return null
  const top = Math.min(menu.rect.bottom + 6, window.innerHeight - 260)
  const left = Math.min(menu.rect.left, window.innerWidth - 272)
  return createPortal(
    <div
      role="listbox"
      aria-label="Mention a user"
      style={{ position: "fixed", top, left }}
      className="bg-popover text-popover-foreground z-[100] w-64 overflow-hidden rounded-lg border p-1 shadow-lg"
    >
      {menu.loading && menu.items.length === 0 ? (
        <div className="text-muted-foreground flex items-center gap-2 px-2 py-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> Searching…
        </div>
      ) : menu.items.length === 0 ? (
        <div className="text-muted-foreground px-2 py-2 text-sm">No matching users</div>
      ) : (
        menu.items.map((u, i) => (
          <button
            key={u.id}
            type="button"
            role="option"
            aria-selected={i === menu.index}
            onMouseDown={e => {
              e.preventDefault()
              onPick(i)
            }}
            className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm", i === menu.index && "bg-accent")}
          >
            <UserAvatar name={u.name} src={u.avatarUrl} size="sm" />
            <span className="truncate">{u.name}</span>
          </button>
        ))
      )}
    </div>,
    document.body
  )
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something…",
  searchUsers,
  onSubmit,
  disabled,
  autoFocus,
  minHeight = "8rem",
  name,
  className,
  ref,
  ...aria
}: RichTextEditorProps) {
  const [menu, setMenu] = React.useState<MenuState | null>(null)
  const [html, setHtml] = React.useState(value ?? "")
  // Stable mutable bridge read only by editor callbacks (never during render).
  const [bridge] = React.useState(() => new EditorBridge({ searchUsers, onChange, onSubmit, value: value ?? "", onMenu: setMenu }))

  React.useEffect(() => {
    bridge.sync({ searchUsers, onChange, onSubmit })
  })

  const mentionsEnabled = Boolean(searchUsers)

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: !disabled,
      autofocus: autoFocus ? "end" : false,
      content: value || "",
      editorProps: {
        attributes: {
          class: "rich-text px-3 py-2.5 outline-none",
          style: `min-height:${minHeight}`,
          role: "textbox",
          "aria-multiline": "true",
          ...(aria["aria-label"] ? { "aria-label": aria["aria-label"] } : {}),
        },
        handleKeyDown: (_view, event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && bridge.onSubmit) {
            event.preventDefault()
            bridge.onSubmit()
            return true
          }
          return false
        },
      },
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
          link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } },
        }),
        Placeholder.configure({ placeholder }),
        ...(mentionsEnabled
          ? [
              Mention.configure({
                HTMLAttributes: { "data-type": "mention" },
                renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
                renderHTML: ({ node }) => [
                  "span",
                  { "data-type": "mention", "data-id": node.attrs.id, "data-label": node.attrs.label ?? "" },
                  `@${node.attrs.label ?? node.attrs.id}`,
                ],
                suggestion: {
                  char: "@",
                  allowSpaces: false,
                  items: async ({ query }: { query: string }) => {
                    const search = bridge.search
                    if (!search) return []
                    if (bridge.menu) bridge.updateMenu({ ...bridge.menu, loading: true })
                    try {
                      return (await search(query)).slice(0, 8)
                    } catch {
                      return []
                    }
                  },
                  render: () => {
                    const toState = (props: SuggestionProps<MentionUser>): MenuState => ({
                      items: props.items,
                      command: attrs => props.command(attrs as never),
                      rect: props.clientRect?.() ?? null,
                      index: 0,
                      loading: false,
                    })
                    return {
                      onStart: (props: SuggestionProps<MentionUser>) => bridge.updateMenu(toState(props)),
                      onUpdate: (props: SuggestionProps<MentionUser>) => bridge.updateMenu(toState(props)),
                      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
                        const m = bridge.menu
                        if (!m) return false
                        if (event.key === "Escape") {
                          bridge.updateMenu(null)
                          return true
                        }
                        if (!m.items.length) return false
                        if (event.key === "ArrowDown") {
                          bridge.updateMenu({ ...m, index: (m.index + 1) % m.items.length })
                          return true
                        }
                        if (event.key === "ArrowUp") {
                          bridge.updateMenu({ ...m, index: (m.index - 1 + m.items.length) % m.items.length })
                          return true
                        }
                        if (event.key === "Enter" || event.key === "Tab") {
                          const u = m.items[m.index]
                          if (u) m.command({ id: u.id, label: u.name })
                          return true
                        }
                        return false
                      },
                      onExit: () => bridge.updateMenu(null),
                    }
                  },
                },
              }),
            ]
          : []),
      ],
      onUpdate: ({ editor: e }) => {
        const out = normalize(e.getHTML())
        bridge.setLastEmitted(out)
        setHtml(out)
        bridge.onChange?.(out, collectMentionIds(e))
      },
    },
    [mentionsEnabled]
  )

  React.useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  React.useEffect(() => {
    if (!editor || value === undefined) return
    if (value === bridge.lastEmitted) return
    bridge.setLastEmitted(value)
    setHtml(value)
    editor.commands.setContent(value || "", { emitUpdate: false })
  }, [editor, value])

  React.useImperativeHandle(
    ref,
    () => ({
      focus: () => editor?.commands.focus("end"),
      clear: () => {
        editor?.commands.clearContent(true)
      },
      getHTML: () => (editor ? normalize(editor.getHTML()) : ""),
      getMentionIds: () => (editor ? collectMentionIds(editor) : []),
      isEmpty: () => editor?.isEmpty ?? true,
    }),
    [editor]
  )

  return (
    <div
      className={cn(
        "border-input bg-background dark:bg-input/20 focus-within:border-ring focus-within:ring-ring/25 overflow-hidden rounded-md border shadow-xs transition-[border-color,box-shadow] focus-within:ring-[3px]",
        disabled && "opacity-60",
        className
      )}
    >
      {editor ? <Toolbar editor={editor} disabled={disabled} /> : <div className="h-9 border-b" />}
      {editor ? (
        <EditorContent editor={editor} />
      ) : (
        <div className="text-muted-foreground px-3 py-2.5 text-sm" style={{ minHeight }}>
          {placeholder}
        </div>
      )}
      {menu && (
        <MentionMenu
          menu={menu}
          onPick={i => {
            const u = menu.items[i]
            if (u) menu.command({ id: u.id, label: u.name })
          }}
        />
      )}
      {name ? <input type="hidden" name={name} value={html} /> : null}
    </div>
  )
}
