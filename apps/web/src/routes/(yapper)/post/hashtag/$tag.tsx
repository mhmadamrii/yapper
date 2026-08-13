import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(yapper)/post/hashtag/$tag')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(yapper)/post/hashtag/$tag"!</div>
}
