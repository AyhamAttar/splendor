import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class RegisterDto {
  @IsEmail({}, { message: "A valid email is required." })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters." })
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  displayName?: string;
}
