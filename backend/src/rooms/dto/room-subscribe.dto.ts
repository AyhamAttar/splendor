import { IsString, Length } from "class-validator";

/** Payload for the lobby gateway `room:subscribe` event. */
export class RoomSubscribeDto {
  @IsString()
  @Length(1, 32)
  code!: string;
}
