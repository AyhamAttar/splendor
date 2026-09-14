import { IsString, Length } from "class-validator";

/** Payload for the game gateway `subscribe` event. */
export class SubscribeDto {
  @IsString()
  @Length(1, 64)
  gameId!: string;
}
