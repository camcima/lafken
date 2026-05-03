import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

import { STRATEGY_KEY } from "./azure-ad-bearer-authn.strategy";

@Injectable()
export class AzureAdBearerAuthnGuard extends AuthGuard(STRATEGY_KEY) {}
