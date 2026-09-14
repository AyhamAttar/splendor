import { IsInt, IsObject, IsOptional, Min } from "class-validator";
import type { Action, TokenBag } from "@splendor/engine";

/**
 * DTO validation stays shallow on purpose: the engine is the authority and
 * fully re-validates the action shape (INVALID_ACTION_SHAPE). Duplicating rule
 * logic in decorators would create a second source of truth.
 */
export class TurnCommandDto {
  @IsInt()
  @Min(0)
  expectedTurn!: number;

  @IsObject()
  action!: Action;

  @IsOptional()
  @IsObject()
  returnTokens?: TokenBag;

  @IsOptional()
  @IsInt()
  nobleId?: number;
}
