import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';

/**
 * Renders `children` only when `when` is truthy, otherwise renders `fallback`.
 *
 * Pass a callback as `children` to receive the narrowed (non-nullable) value:
 * ```tsx
 * <Show when={user} fallback={<Skeleton />}>
 *   {(u) => <p>{u.name}</p>}
 * </Show>
 * ```
 * Or pass JSX directly (no narrowing):
 * ```tsx
 * <Show when={isOpen}><Modal /></Show>
 * ```
 */
interface ShowProps<T> {
  when: T | null | undefined | false | 0 | '';
  fallback?: ReactNode;
  children: ReactNode | ((value: NonNullable<T>) => ReactNode);
}

export function Show<T>({ when, fallback = null, children }: ShowProps<T>) {
  if (!when) return <>{fallback}</>;
  return (
    <>
      {typeof children === 'function'
        ? (children as (v: NonNullable<T>) => ReactNode)(when as NonNullable<T>)
        : children}
    </>
  );
}

/**
 * Used as a child of `<Switch>`. Renders `children` when `when` is truthy.
 *
 * Pass a callback as `children` to receive the narrowed (non-nullable) value:
 * ```tsx
 * <Match when={data}>
 *   {(d) => <Table rows={d} />}
 * </Match>
 * ```
 */
interface MatchProps<T> {
  when: T | null | undefined | false | 0 | '';
  children: ReactNode | ((value: NonNullable<T>) => ReactNode);
}

export function Match<T>({ when, children }: MatchProps<T>) {
  if (!when) return null;
  return (
    <>
      {typeof children === 'function'
        ? (children as (v: NonNullable<T>) => ReactNode)(when as NonNullable<T>)
        : children}
    </>
  );
}

/**
 * Renders the first `<Match>` whose `when` prop is truthy, like a
 * type-safe if-else chain. Falls back to `fallback` if none match.
 *
 * ```tsx
 * <Switch fallback={<EmptyState />}>
 *   <Match when={isLoading}><Skeleton /></Match>
 *   <Match when={error}>{(e) => <p>{e.message}</p>}</Match>
 *   <Match when={data}>{(d) => <Table rows={d} />}</Match>
 * </Switch>
 * ```
 */
interface SwitchProps {
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Maps over an array, rendering `children` for each item. Renders `fallback`
 * when the array is empty or nullish.
 *
 * ⚠️ Unlike SolidJS, React requires a `key` prop on each rendered element —
 * set it inside the callback:
 * ```tsx
 * <For each={users} fallback={<EmptyState />}>
 *   {(user) => <Row key={user.id} user={user} />}
 * </For>
 * ```
 */
interface ForProps<T> {
  each: readonly T[] | null | undefined;
  fallback?: ReactNode;
  children: (item: T, index: number) => ReactNode;
}

export function For<T>({ each, fallback = null, children }: ForProps<T>) {
  if (!each?.length) return <>{fallback}</>;
  return <>{each.map((item, i) => children(item, i))}</>;
}

export function Switch({ fallback = null, children }: SwitchProps) {
  for (const child of Children.toArray(children)) {
    if (isValidElement(child) && (child.props as { when?: unknown }).when) {
      return child as ReactElement;
    }
  }
  return <>{fallback}</>;
}
