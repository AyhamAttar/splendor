import { IsString, Matches, MaxLength } from "class-validator";

export class JoinQueueDto {
  @IsString()
  @Matches(/\S/, { message: "name cannot be blank" })
  @MaxLength(20)
  name!: string;
}
