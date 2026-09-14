import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";

/**
 * Editable profile fields (Phase 4). All optional — only present fields change.
 * An empty string on `displayName`/`avatar` clears it (validators are skipped
 * via `@ValidateIf`); a `handle`, once set, can be changed but not blanked.
 */
export class UpdateProfileDto {
  @IsOptional()
  @ValidateIf((o: UpdateProfileDto) => o.displayName !== "")
  @IsString()
  @Matches(/\S/, { message: "displayName cannot be blank" })
  @MaxLength(20)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_]{3,20}$/, {
    message: "handle must be 3–20 letters, digits, or underscores",
  })
  handle?: string;

  @IsOptional()
  @ValidateIf((o: UpdateProfileDto) => o.avatar !== "")
  @IsString()
  @MaxLength(500)
  @IsUrl(
    { require_protocol: true, protocols: ["http", "https"] },
    { message: "avatar must be a valid http(s) URL" },
  )
  avatar?: string;
}
