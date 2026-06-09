'use client';

import type { ButtonHTMLAttributes } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemShellProps {
  id: string;
  /** Children. They receive no special props; the shell owns the drag behavior. */
  children: React.ReactNode;
  /** Optional className applied to the outer wrapper. */
  className?: string;
}

/**
 * Wrapper shell for a single draggable list item.
 *
 * Owns:
 *   - the dnd-kit sortable binding (ref, transform, transition)
 *   - the dragging-state styling (lift + z-index)
 *
 * Does NOT own:
 *   - the drag handle. The handle is a separate <SortableHandle> component
 *     that consumers render INSIDE their card header. The handle pulls
 *     `useSortable(id)` itself, so it gets the same drag binding the
 *     shell uses for its own transform.
 *
 * Why two useSortable calls per item (one in the shell, one in the
 * handle)? dnd-kit's `useSortable` is a hook — both calls return the
 * SAME data because they share the same id and the hook is memoized
 * internally. So this is cheap.
 *
 * Activation constraint (5px before drag starts) is set on the sensor in
 * the parent DndContext, not here.
 */
export function SortableItemShell({ id, children, className = '' }: SortableItemShellProps) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 'auto',
    position: 'relative',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={className}
      data-dragging={isDragging || undefined}
    >
      {children}
    </div>
  );
}

type SortableHandleProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'ref' | 'type'
> & {
  id: string;
};

/**
 * The visible "grab me" affordance. Spreads dnd-kit's pointer/touch/keyboard
 * listeners and a11y attributes onto a small button. Render this inside the
 * card's header so users have a specific spot to grab.
 *
 * The button is a real <button type="button"> for keyboard focus, screen
 * readers, and the visual focus ring.
 */
export function SortableHandle({ id, ...rest }: SortableHandleProps) {
  const { attributes, listeners, setActivatorNodeRef } = useSortable({ id });

  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      aria-label="Drag to reorder"
      className="inline-flex h-7 w-5 cursor-grab active:cursor-grabbing items-center justify-center rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 touch-none select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100"
      {...attributes}
      {...listeners}
      {...rest}
    >
      <svg
        width="10"
        height="14"
        viewBox="0 0 10 14"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="2" cy="2" r="1.2" />
        <circle cx="8" cy="2" r="1.2" />
        <circle cx="2" cy="7" r="1.2" />
        <circle cx="8" cy="7" r="1.2" />
        <circle cx="2" cy="12" r="1.2" />
        <circle cx="8" cy="12" r="1.2" />
      </svg>
    </button>
  );
}
