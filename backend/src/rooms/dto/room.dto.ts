import {
  IsBoolean,
  IsInt,
  IsString,
  Matches,
  MaxLength,
  Max,
  Min,
} from "class-validator";

/** Shared display-name rule: non-blank, at most 20 chars (matches createGame). */
class NamedDto {
  @IsString()
  @Matches(/\S/, { message: "name cannot be blank" })
  @MaxLength(20)
  name!: string;
}

export class CreateRoomDto extends NamedDto {}

export class JoinRoomDto extends NamedDto {}

export class ReadyDto {
  @IsBoolean()
  ready!: boolean;
}

export class SeatsDto {
  @IsInt()
  @Min(2)
  @Max(4)
  maxPlayers!: number;
}

export class KickDto {
  @IsString()
  @MaxLength(64)
  memberId!: string;
}
