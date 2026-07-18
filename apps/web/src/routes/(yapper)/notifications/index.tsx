import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(yapper)/notifications/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/notifications/"!</div>
}
