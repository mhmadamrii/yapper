import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@yapper/api/routers/index";

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();
