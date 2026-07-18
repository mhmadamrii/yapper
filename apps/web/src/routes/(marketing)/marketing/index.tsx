import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(marketing)/marketing/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(marketing)/marketing/"!</div>
}
