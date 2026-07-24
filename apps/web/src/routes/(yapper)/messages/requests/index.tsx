import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(yapper)/messages/requests/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(yapper)/messages/requests/"!</div>
}
