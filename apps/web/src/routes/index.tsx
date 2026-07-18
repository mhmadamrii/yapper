import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { useTRPC } from '@/utils/trpc';

export const Route = createFileRoute('/')({
  component: HomeComponent,
});

function HomeComponent() {
  const trpc = useTRPC();
  const healthCheck = useQuery(trpc.healthCheck.queryOptions());

  return (
    <div>
      <h1>{healthCheck.data}</h1>
      <p>
        Lorem ipsum dolor sit amet, consectetur adipisicing elit. Sit, saepe?
        Nisi explicabo quidem, sit ad repudiandae tempore delectus, minus modi
        ullam sed ratione aspernatur, hic eveniet eum officiis. Accusamus
        dignissimos suscipit, sunt neque quas in atque modi placeat incidunt,
        itaque repellendus. Quia temporibus modi quis doloremque possimus error
        asperiores, labore impedit expedita ratione, consectetur iusto aperiam
        nihil, iure sed architecto. Adipisci consectetur quaerat deserunt
        necessitatibus enim harum beatae laboriosam fugiat quos deleniti,
        asperiores suscipit fuga vero iste assumenda. Voluptas consequatur velit
        aperiam odit quod delectus, enim fuga maiores modi repellat voluptatem
        tenetur rerum dolor quibusdam quo mollitia quaerat illo, adipisci sunt
        error sequi. Similique animi aut sapiente doloribus reiciendis, expedita
        mollitia, dignissimos itaque aperiam tempora incidunt veniam ut
        voluptates doloremque vitae dolorem iusto nam ullam. Odio temporibus
        fugit cum aut qui accusantium enim laboriosam asperiores dicta a nostrum
        quasi deleniti tempora, unde tempore aperiam ipsam reprehenderit
        repellendus ea. Quaerat placeat eligendi eaque nihil consequatur a
        exercitationem nobis voluptatem est? Necessitatibus, possimus dicta iure
        aliquid tempore dignissimos neque facilis et qui excepturi distinctio
        numquam quidem corporis perferendis consequatur eveniet quasi. Numquam,
        veritatis? Ad veritatis harum consectetur voluptatum esse doloribus
        dignissimos minima delectus facere ipsa fugiat fugit ullam et unde, rem
        porro exercitationem omnis cum vel quia ut deserunt! Repudiandae
        accusantium alias accusamus ratione laudantium magnam cupiditate vel
        praesentium, molestiae similique labore necessitatibus minima suscipit
        quas, nisi dolores aspernatur! Commodi neque soluta aperiam nam aliquam
        laborum corrupti sed sint quo quibusdam totam dolore asperiores voluptas
        nihil ducimus iure laudantium qui, delectus laboriosam facilis assumenda
        blanditiis. Numquam consequatur nobis eos in provident quo rem, vel
        adipisci! In modi non sunt corporis eaque eum distinctio adipisci.
        Cumque numquam quisquam accusantium modi, sequi quae culpa
        necessitatibus porro odit veritatis, expedita nihil molestiae? Ut
        facilis laboriosam ullam nulla maiores adipisci error eius soluta. Odio,
        neque ea.
      </p>
    </div>
  );
}
