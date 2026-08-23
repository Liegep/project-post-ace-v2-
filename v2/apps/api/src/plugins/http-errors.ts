import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

type HttpErrorFactory = (message: string) => Error & { statusCode: number };

function makeHttpError(statusCode: number): HttpErrorFactory {
  return (message: string) => Object.assign(new Error(message), { statusCode });
}

async function httpErrorsPlugin(app: FastifyInstance) {
  app.decorate("httpErrors", {
    unauthorized: makeHttpError(401),
    forbidden: makeHttpError(403),
    notFound: makeHttpError(404),
    badRequest: makeHttpError(400),
    conflict: makeHttpError(409),
  });
}

export const httpErrorsPluginRegistered = fp(httpErrorsPlugin, {
  name: "http-errors-plugin",
});
