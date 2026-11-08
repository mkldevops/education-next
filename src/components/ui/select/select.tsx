'use client'

import { Select as SelectPrimitive } from '@base-ui/react/select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '../utils'

const Select = SelectPrimitive.Root

type SelectProps = SelectPrimitive.Root.Props<unknown>

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn('scroll-my-1 p-1', className)}
      {...props}
    />
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn('flex flex-1 truncate text-left', className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: SelectPrimitive.Trigger.Props & { size?: 'sm' | 'default' }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded border border-input bg-white px-3 text-sm',
        'whitespace-nowrap outline-none select-none data-[size=default]:h-10 data-[size=sm]:h-8',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25',
        'disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-placeholder',
        'aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/20',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0',
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="flex">
        <ChevronDown className="size-4 text-graphite-700" aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = 'bottom',
  sideOffset = 4,
  align = 'center',
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset' | 'alignItemWithTrigger'
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-60"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            'relative isolate max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin)',
            'overflow-x-hidden overflow-y-auto rounded border border-alabaster-700 bg-popover py-1 text-graphite shadow-lg',
            'transition-[opacity,scale] duration-(--duration-fast) ease-out',
            'data-[align-trigger=false]:data-starting-style:scale-95 data-[align-trigger=false]:data-starting-style:opacity-0',
            'data-ending-style:opacity-0',
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn('px-3 py-1 text-xs text-muted-foreground', className)}
      {...props}
    />
  )
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'relative flex w-full cursor-default items-center gap-2 py-2 pr-9 pl-3 text-sm outline-hidden select-none',
        'data-highlighted:bg-alabaster-800 data-selected:font-medium',
        'data-disabled:pointer-events-none data-disabled:opacity-50',
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex min-w-0 flex-1 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-3 flex size-4 items-center justify-center" />
        }
      >
        <Check className="size-4 text-foreground" aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('pointer-events-none my-1 h-px bg-border', className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        'top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1',
        className
      )}
      {...props}
    >
      <ChevronUp className="size-4" aria-hidden="true" />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        'bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1',
        className
      )}
      {...props}
    >
      <ChevronDown className="size-4" aria-hidden="true" />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  type SelectProps,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
