import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateGameDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @Matches(/\S/, { each: true, message: "names cannot be blank" })
  @MaxLength(20, { each: true })
  playerNames!: string[];

  @IsOptional()
  @IsInt()
  seed?: number;
}
