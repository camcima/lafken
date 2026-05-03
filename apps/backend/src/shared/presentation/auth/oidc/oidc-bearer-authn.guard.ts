import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

import { STRATEGY_KEY } from "./oidc-bearer-authn.strategy";

@Injectable()
export class OidcBearerAuthnGuard extends AuthGuard(STRATEGY_KEY) {}
