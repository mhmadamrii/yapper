import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/saved/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/saved/"!</div>
}
