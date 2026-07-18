import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(yapper)/profile/$userId/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/profile/$userId/"!</div>
}
