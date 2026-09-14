import { HttpException, HttpStatus } from "@nestjs/common";
import type { EngineError } from "@splendor/engine";

/**
 * Map an EngineError to an HTTP exception. The response body IS the engine
 * error verbatim (so the frontend can switch on `code`) plus a human message.
 * Everything except GAME_FINISHED is 422 (well-formed but illegal for state).
 */
export function engineErrorToHttp(error: EngineError): HttpException {
  const status =
    error.code === "GAME_FINISHED"
      ? HttpStatus.CONFLICT
      : HttpStatus.UNPROCESSABLE_ENTITY;
  return new HttpException(
    { statusCode: status, message: describe(error), ...error },
    status,
  );
}

function describe(e: EngineError): string {
  switch (e.code) {
    case "GAME_FINISHED":
      return "The game is already over.";
    case "INVALID_ACTION_SHAPE":
      return `Malformed action: ${e.detail}`;
    case "EMPTY_PILE":
      return `No ${e.gem} tokens left to take.`;
    case "DUPLICATE_GEMS":
      return "Taking 3 gems requires three different colors.";
    case "TOO_MANY_GEMS":
      return "You can take at most 3 different gems.";
    case "NO_GEMS_SELECTED":
      return "Select at least one gem to take.";
    case "PILE_BELOW_FOUR":
      return `You can only take two ${e.gem} when at least 4 remain.`;
    case "CARD_NOT_AVAILABLE":
      return "That card is not available.";
    case "DECK_EMPTY":
      return `The level ${e.level} deck is empty.`;
    case "RESERVE_LIMIT":
      return "You already have 3 reserved cards.";
    case "CANNOT_AFFORD":
      return "You cannot afford that card.";
    case "INVALID_PAYMENT":
      return `Invalid payment: ${e.reason}`;
    case "TOKEN_RETURN_REQUIRED":
      return `You must return ${e.mustReturn} token(s) to stay under 10.`;
    case "INVALID_TOKEN_RETURN":
      return `Invalid token return: ${e.reason}`;
    case "NOBLE_CHOICE_REQUIRED":
      return "More than one noble qualifies — choose one.";
    case "NOBLE_NOT_ELIGIBLE":
      return "That noble is not eligible to visit.";
    case "PASS_NOT_ALLOWED":
      return "You can only pass when no other action is possible.";
  }
}
