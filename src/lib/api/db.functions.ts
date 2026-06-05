import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRepo, getScan, getFixRequest, getRecentFixRequests, getRecentScans } from "../db.server";

export const getRepoFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ repoId: z.string() }))
  .handler(({ data }) => getRepo(data.repoId));

export const getScanFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ repoId: z.string() }))
  .handler(({ data }) => getScan(data.repoId));

export const getFixRequestByIdFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => getFixRequest(data.id));

export const getRecentScansFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ owner: z.string().optional() }))
  .handler(({ data }) => getRecentScans(data.owner));

export const getRecentFixRequestsFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ owner: z.string().optional() }))
  .handler(({ data }) => getRecentFixRequests(data.owner));
