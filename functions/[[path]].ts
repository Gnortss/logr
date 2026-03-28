import { createPagesFunctionHandler } from "@react-router/cloudflare";

// @ts-ignore - virtual module provided by React Router build
import * as build from "../build/server";

export const onRequest = createPagesFunctionHandler({ build });
