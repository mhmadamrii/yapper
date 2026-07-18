import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(yapper)/search/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/search/"!</div>
}
