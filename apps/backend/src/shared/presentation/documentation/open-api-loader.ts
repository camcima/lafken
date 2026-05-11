import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from "@nestjs/swagger";

import { environmentConfiguration } from "../../infrastructure/environment.configuration";
import { openapiConfiguration } from "./openapi.configuration";

export function loadSwaggerForNestjsApp(app: INestApplication): void {
  const IS_CLOUD_ENDPOINT_DEFINITION = environmentConfiguration.CLOUD_ENDPOINT_DEFINITION;

  const documentBuilder = (): OpenAPIObject => {
    const optionsBuilder = new DocumentBuilder()
      .setTitle(openapiConfiguration.title)
      .setDescription(openapiConfiguration.description)
      .setVersion(openapiConfiguration.version)
      .setContact(
        openapiConfiguration.contact.name,
        openapiConfiguration.contact.url,
        openapiConfiguration.contact.email,
      )
      .addBearerAuth({
        type: "http",
        scheme: "bearer",
        description: "OIDC Bearer token authorization",
      });

    if (IS_CLOUD_ENDPOINT_DEFINITION) {
      optionsBuilder
        .addServer("https://<%= service_name %>", "Cloud Endpoints service URL")
        .addSecurity("oidc_jwt", {
          type: "oauth2",
          flows: {
            implicit: {
              authorizationUrl: "",
              scopes: {},
            },
          },

          ["x-google-auth"]: {
            issuer: "<%=oidc_issuer%>",
            jwksUri: "<%=oidc_issuer%>/.well-known/jwks.json",
            audiences: ["<%=oidc_audience%>"],
            jwtLocations: [
              {
                header: "Authorization",
                valuePrefix: "Bearer ",
              },
            ],
          },
        })
        .addSecurity("api_key", {
          type: "apiKey",
          in: "query",
          name: "key",
          description: "API key for external clients (e.g., HTTP Sink Connector)",
        })
        // Documentation at https://docs.cloud.google.com/endpoints/docs/openapi/openapi-extensions
        .addExtension("x-google-api-management", {
          backends: {
            backend: {
              address: "http://127.0.0.1:3000", // The port is where the Backend app is running in the Cloud
              // Since we are using a sidecar container under HTTP, we need to use HTTP/1.1
              protocol: "http/1.1",
              // The number of seconds to wait for a complete response to a request
              deadline: 600.0,
              // The backend request path is calculated by appending the original request path to the address URL of the x-google-backend extension
              pathTranslation: "APPEND_PATH_TO_ADDRESS",
              // Disables receiving an instance ID token. And prevents it from being added to the request.
              disableAuth: true,
            },
          },
        })
        // Routes all requests to the backend defined above.
        // x-google-backend at the top level applies to all operations (path_translation uses snake_case per ESPv2 spec).
        .addExtension("x-google-backend", {
          address: "http://127.0.0.1:3000",
          protocol: "http/1.1",
          deadline: 600.0,
          path_translation: "APPEND_PATH_TO_ADDRESS",
          disable_auth: true,
        })
        // Global security (applies to all operations unless overridden)
        // Note: Using only OIDC JWT. API key authentication is defined in securitySchemes
        // but not enforced globally to avoid OR logical combination which is not supported.
        .addSecurityRequirements("oidc_jwt", []);
    }

    const options = optionsBuilder.build();

    const document = SwaggerModule.createDocument(app, options, {
      ignoreGlobalPrefix: false,
    });

    // Add x-google-endpoint extension to the Cloud Endpoints server
    // See: https://docs.cloud.google.com/endpoints/docs/openapi/oasv3-extensions?#x-google-endpoint
    if (document.servers && document.servers.length > 0) {
      const cloudEndpointsServer = document.servers.find((server) =>
        server.url.includes("<%= service_name %>"),
      );
      if (cloudEndpointsServer) {
        (cloudEndpointsServer as unknown as Record<string, unknown>)["x-google-endpoint"] = {
          allowCors: true,
        };
      }
    }

    return document;
  };

  SwaggerModule.setup("/openapi", app, documentBuilder, {
    useGlobalPrefix: true,
    customSiteTitle: openapiConfiguration.title,
    jsonDocumentUrl: "/openapi.json",
    yamlDocumentUrl: "/openapi.yaml",
    swaggerOptions: {
      filter: true,
      displayRequestDuration: true,
      withCredentials: true,
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 10,
      defaultModelRendering: "model",
    },
  });
}
